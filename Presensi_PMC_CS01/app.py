from flask import Flask, render_template, request, jsonify, session, make_response, send_from_directory
from flask_cors import CORS
import os, json, datetime, csv, io, base64, re

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)
app.secret_key = os.environ.get("FLASK_SECRET", "supersecret_pmc_2025")

# === Folder & File ===
DATA_DIR = "data"
UPLOAD_DIR = os.path.join("static", "uploads")
USERS_FILE = os.path.join(DATA_DIR, "users.json")
ABSEN_FILE = os.path.join(DATA_DIR, "absensi.json")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# === Helper ===
def read_json(path):
    if not os.path.exists(path): return []
    with open(path, "r", encoding="utf-8") as f:
        try: return json.load(f)
        except: return []

def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def delete_file_safe(path):
    try:
        if not path:
            return
        # normalize path: allow "/static/uploads/..." or "static/uploads/..."
        p = path[1:] if path.startswith("/") else path
        if os.path.exists(p):
            os.remove(p)
    except Exception:
        pass

# Init data
if not os.path.exists(USERS_FILE):
    write_json(USERS_FILE, [{"username":"admin","password":"PMC2025!"}])
if not os.path.exists(ABSEN_FILE):
    write_json(ABSEN_FILE, [])

# === Frontend ===
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/dashboard")
def dashboard():
    if not session.get("user"):
        return render_template("index.html")
    return render_template("dashboard.html", user=session["user"])

# === Auth ===
@app.route("/api/whoami")
def whoami():
    return jsonify({"user": session.get("user")})

@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    users = read_json(USERS_FILE)
    user = next((u for u in users if u["username"] == data.get("username") and u["password"] == data.get("password")), None)
    if user:
        session["user"] = user["username"]
        return jsonify({"ok": True, "user": user["username"]})
    return jsonify({"ok": False, "error": "Username atau password salah"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("user", None)
    return jsonify({"ok": True})

@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()
    if not username or not password:
        return jsonify({"ok": False, "error": "Isi semua kolom"}), 400
    users = read_json(USERS_FILE)
    if any(u["username"] == username for u in users):
        return jsonify({"ok": False, "error": "Username sudah ada"}), 400
    users.append({"username": username, "password": password})
    write_json(USERS_FILE, users)
    return jsonify({"ok": True, "msg": "Akun berhasil dibuat"})

# === Util ===
def save_photo(base64_str, nama, jenis):
    """Decode base64 image -> save to static/uploads, return relative path"""
    if not base64_str or not base64_str.startswith("data:image"):
        return ""
    img_data = re.sub(r"^data:image/.+;base64,", "", base64_str)
    img_bytes = base64.b64decode(img_data)
    safe_nama = re.sub(r'[^a-zA-Z0-9_-]+', '_', nama)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"{safe_nama}_{jenis}_{ts}.jpg"
    fpath = os.path.join(UPLOAD_DIR, fname)
    with open(fpath, "wb") as f:
        f.write(img_bytes)
    return f"/static/uploads/{fname}"

# === Absen ===
@app.route("/api/absen", methods=["POST"])
def absen():
    if not session.get("user"):
        return jsonify({"ok": False, "error": "Belum login"}), 401

    payload = request.get_json() or {}
    nama = payload.get("nama")
    jenis = payload.get("type")
    ket = payload.get("keterangan", "")
    foto_b64 = payload.get("foto", "")
    lat = payload.get("lat", "")
    lon = payload.get("lon", "")
    time = payload.get("time") or datetime.datetime.now().strftime("%H:%M:%S")
    date = payload.get("date") or datetime.datetime.now().strftime("%d/%m/%Y")

    absensi = read_json(ABSEN_FILE)
    rec = next((r for r in absensi if r["nama"]==nama and r["tanggal"]==date), None)
    if not rec:
        rec = {"nama": nama, "tanggal": date, "datang": "", "pulang": "",
               "fotoDatang": "", "fotoPulang": "", "lama": "", "lamaSeconds": 0,
               "keterangan": ket, "lat": lat, "lon": lon}
        absensi.append(rec)

    if jenis == "datang":
        rec["datang"] = time
        rec["fotoDatang"] = save_photo(foto_b64, nama, "datang")
        rec["keterangan"] = ket
        rec["lat"], rec["lon"] = lat, lon
    elif jenis == "pulang":
        rec["pulang"] = time
        rec["fotoPulang"] = save_photo(foto_b64, nama, "pulang")
        rec["lat"], rec["lon"] = lat, lon
        try:
            h1,m1,s1 = map(int, rec["datang"].split(":")) if rec.get("datang") else (0,0,0)
            h2,m2,s2 = map(int, rec["pulang"].split(":"))
            a = h1*3600+m1*60+s1; b = h2*3600+m2*60+s2
            d = b - a if b >= a else 86400 - a + b
            rec["lamaSeconds"] = d
            rec["lama"] = f"{d//3600:02d}:{(d%3600)//60:02d}:{d%60:02d}"
        except Exception:
            pass

    write_json(ABSEN_FILE, absensi)
    return jsonify({"ok": True, "record": rec})

@app.route("/api/rekap")
def rekap():
    absensi = read_json(ABSEN_FILE)
    return jsonify({"ok": True, "data": absensi})

@app.route("/api/delete_absen", methods=["POST"])
def delete_absen():
    payload = request.get_json() or {}
    nama = payload.get("nama")
    tanggal = payload.get("tanggal")
    if not nama or not tanggal:
        return jsonify({"ok": False, "error": "Data tidak lengkap"}), 400

    absensi = read_json(ABSEN_FILE)
    target = next((r for r in absensi if r["nama"]==nama and r["tanggal"]==tanggal), None)
    if not target:
        return jsonify({"ok": False, "error": "Data tidak ditemukan"}), 404

    # delete files
    delete_file_safe(target.get("fotoDatang", ""))
    delete_file_safe(target.get("fotoPulang", ""))

    absensi = [r for r in absensi if not (r["nama"]==nama and r["tanggal"]==tanggal)]
    write_json(ABSEN_FILE, absensi)
    return jsonify({"ok": True, "msg": "Data berhasil dihapus"})

@app.route("/api/export.csv")
def export_csv():
    absensi = read_json(ABSEN_FILE)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["nama","tanggal","keterangan","datang","pulang","lama","lat","lon","fotoDatang","fotoPulang"])
    for r in absensi:
        writer.writerow([r.get("nama"), r.get("tanggal"), r.get("keterangan",""), r.get("datang",""),
                         r.get("pulang",""), r.get("lama",""), r.get("lat",""), r.get("lon",""),
                         r.get("fotoDatang",""), r.get("fotoPulang","")])
    resp = make_response(output.getvalue())
    resp.headers["Content-Disposition"] = "attachment; filename=rekap_absen.csv"
    resp.headers["Content-Type"] = "text/csv; charset=utf-8"
    return resp

@app.route("/static/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, filename)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
