
import json
from getpass import getpass
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"
API_BASE = "http://127.0.0.1:8083/api/v1"


def load_env():
    if not ENV_FILE.is_file():
        raise SystemExit("File backend/.env tidak ditemukan")

    values = {}

    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        value = value.strip()

        if len(value) >= 2 and value[0] == value[-1] and value[0] in "'\"":
            value = value[1:-1]

        values[key.strip()] = value

    return values


def send_request(url, method="GET", payload=None, headers=None):
    data = None

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    request = Request(
        url,
        data=data,
        headers=headers or {},
        method=method,
    )

    try:
        with urlopen(request, timeout=20) as response:
            body = response.read()
            result = json.loads(body) if body else {}
            return response.status, result

    except HTTPError as error:
        return error.code, {}

    except URLError:
        raise SystemExit("Koneksi gagal. Periksa backend dan internet.")


def main():
    env = load_env()

    supabase_url = env.get("SUPABASE_URL", "").rstrip("/")
    publishable_key = env.get("SUPABASE_PUBLISHABLE_KEY", "")

    if not supabase_url.startswith("https://"):
        raise SystemExit("SUPABASE_URL belum benar")

    if not publishable_key.startswith("sb_publishable_"):
        raise SystemExit("SUPABASE_PUBLISHABLE_KEY belum benar")

    print("=== ASSETFLOW EAM AUTH TEST ===")

    email = input("Email login: ").strip()
    password = getpass("Password login: ")

    if not email or not password:
        raise SystemExit("Email dan password wajib diisi")

    status, result = send_request(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        method="POST",
        payload={
            "email": email,
            "password": password,
        },
        headers={
            "apikey": publishable_key,
            "Content-Type": "application/json",
        },
    )

    password = ""

    if status != 200:
        raise SystemExit(
            f"Login Supabase gagal. HTTP {status}"
        )

    token = result.get("access_token")

    if not token:
        raise SystemExit("Access token tidak ditemukan")

    print("Login Supabase: BERHASIL")

    headers = {
        "Authorization": f"Bearer {token}",
    }

    me_status, me_result = send_request(
        f"{API_BASE}/auth/me",
        headers=headers,
    )

    print(f"GET /auth/me: HTTP {me_status}")

    if me_status == 200:
        user = me_result.get("user", {})
        print("Role:", user.get("role_code", "-"))
        print("Aktif:", user.get("is_active", False))

    admin_status, _ = send_request(
        f"{API_BASE}/access/super-admin",
        headers=headers,
    )

    print(f"GET /access/super-admin: HTTP {admin_status}")

    manager_status, _ = send_request(
        f"{API_BASE}/access/manager",
        headers=headers,
    )

    print(f"GET /access/manager: HTTP {manager_status}")

    valid = (
        me_status == 200
        and me_result.get("user", {}).get("role_code") == "SUPER_ADMIN"
        and me_result.get("user", {}).get("is_active") is True
        and admin_status == 200
        and manager_status == 403
    )

    print("=== HASIL PENGUJIAN ===")
    print("LULUS" if valid else "BELUM LULUS")


if __name__ == "__main__":
    main()
