from flask import Flask, jsonify, request, send_from_directory
from kubernetes import client, config
import copy
import os
from datetime import datetime, timezone

app = Flask(__name__, static_folder="dist", static_url_path="")

NAMESPACE = os.environ.get("NAMESPACE", "kubecost")
CRONJOB_NAME = os.environ.get("CRONJOB_NAME", "kubecost-rightsizing")

try:
    config.load_incluster_config()
except config.ConfigException:
    config.load_kube_config()

batch_v1 = client.BatchV1Api()
core_v1 = client.CoreV1Api()


@app.route("/api/config", methods=["GET"])
def get_config():
    try:
        cj = batch_v1.read_namespaced_cron_job(CRONJOB_NAME, NAMESPACE)
        env_dict = {}
        for c in cj.spec.job_template.spec.template.spec.containers:
            for e in c.env or []:
                if e.value is not None:
                    env_dict[e.name] = e.value
        return jsonify({
            "schedule": cj.spec.schedule,
            "suspended": cj.spec.suspend or False,
            "env": env_dict,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/config", methods=["PUT"])
def update_config():
    data = request.json
    try:
        cj = batch_v1.read_namespaced_cron_job(CRONJOB_NAME, NAMESPACE)

        if "schedule" in data:
            cj.spec.schedule = data["schedule"]
        if "suspended" in data:
            cj.spec.suspend = data["suspended"]
        if "env" in data:
            for c in cj.spec.job_template.spec.template.spec.containers:
                for e in c.env or []:
                    if e.name in data["env"] and e.value is not None:
                        e.value = data["env"][e.name]

        batch_v1.replace_namespaced_cron_job(CRONJOB_NAME, NAMESPACE, cj)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/run", methods=["POST"])
def run_now():
    try:
        cj = batch_v1.read_namespaced_cron_job(CRONJOB_NAME, NAMESPACE)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
        job_name = f"{CRONJOB_NAME}-manual-{timestamp}"

        job_spec = copy.deepcopy(cj.spec.job_template.spec)
        job_spec.selector = None
        if job_spec.template.metadata and job_spec.template.metadata.labels:
            job_spec.template.metadata.labels.pop("job-name", None)
            job_spec.template.metadata.labels.pop("controller-uid", None)

        job = client.V1Job(
            api_version="batch/v1",
            kind="Job",
            metadata=client.V1ObjectMeta(
                name=job_name,
                namespace=NAMESPACE,
                annotations={"cronjob.kubernetes.io/instantiate": "manual"},
            ),
            spec=job_spec,
        )

        batch_v1.create_namespaced_job(NAMESPACE, job)
        return jsonify({"success": True, "jobName": job_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/jobs", methods=["GET"])
def list_jobs():
    try:
        all_jobs = batch_v1.list_namespaced_job(NAMESPACE)
        relevant = [j for j in all_jobs.items if j.metadata.name.startswith(CRONJOB_NAME)]
        relevant.sort(key=lambda j: j.metadata.creation_timestamp, reverse=True)

        result = []
        for job in relevant[:20]:
            if job.status.succeeded:
                status = "succeeded"
            elif job.status.failed and not job.status.active:
                status = "failed"
            elif job.status.active:
                status = "running"
            else:
                status = "pending"

            duration = None
            if job.status.start_time and job.status.completion_time:
                duration = int((job.status.completion_time - job.status.start_time).total_seconds())

            is_manual = (job.metadata.annotations or {}).get(
                "cronjob.kubernetes.io/instantiate"
            ) == "manual"

            result.append({
                "name": job.metadata.name,
                "status": status,
                "startTime": job.status.start_time.isoformat() if job.status.start_time else None,
                "completionTime": job.status.completion_time.isoformat() if job.status.completion_time else None,
                "duration": duration,
                "manual": is_manual,
            })

        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/jobs/<job_name>/logs", methods=["GET"])
def get_job_logs(job_name):
    try:
        pods = core_v1.list_namespaced_pod(NAMESPACE, label_selector=f"job-name={job_name}")
        if not pods.items:
            return jsonify({"logs": "No pods found for this job yet.", "podName": None})

        pod = pods.items[-1]
        try:
            logs = core_v1.read_namespaced_pod_log(pod.metadata.name, NAMESPACE, tail_lines=500)
        except Exception:
            logs = f"Logs not yet available (pod phase: {pod.status.phase})"

        return jsonify({"logs": logs, "podName": pod.metadata.name})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_react(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080, debug=False)
