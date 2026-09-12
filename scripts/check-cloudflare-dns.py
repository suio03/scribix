"""Read-only Cloudflare token and DNS check. Never prints credentials."""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path


def main():
    env_file = Path(__file__).resolve().parent.parent / ".env.local"
    config = {}
    try:
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                config[key.strip()] = value.strip().strip('"').strip("'")
    except OSError:
        print("Cannot read the project's .env.local file.")
        return 1

    token = config.get("CLOUDFLARE_TUNNEL_API_TOKEN") or config.get("CLOUDFLARE_API_TOKEN")
    if not token:
        print("Cloudflare API token is missing from .env.local.")
        return 1

    paths = {
        "Token validity": "/user/tokens/verify",
        "DNS read access": (
            "/zones/c8328bdd293f19b70b135eb678b3b37a"
            "/dns_records?name=local.scribix.io"
        ),
    }
    passed = True
    for label, path in paths.items():
        request = urllib.request.Request(
            "https://api.cloudflare.com/client/v4" + path,
            headers={"Authorization": "Bearer " + token},
        )
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                success = json.load(response).get("success") is True
                print(f"{label}: HTTP {response.status}, success={success}")
                passed = passed and success
        except urllib.error.HTTPError as error:
            print(f"{label}: HTTP {error.code}")
            passed = False
        except (urllib.error.URLError, TimeoutError, ValueError):
            print(f"{label}: Network error or invalid response.")
            passed = False

    if passed:
        print("PASS: Token and DNS reads work. No DNS records were changed.")
        print("DNS write permission must still be set to Zone > DNS > Edit.")
    else:
        print("FAIL: Check the token, its permissions and zone scope.")
    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
