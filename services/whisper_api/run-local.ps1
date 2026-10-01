$ErrorActionPreference = 'Stop'
$env:NLTK_ALLOW_PROXIED_URLOPEN = '1'
Push-Location $PSScriptRoot
try {
  python -m pip install -r requirements.txt
  python -m uvicorn main:app --host 127.0.0.1 --port 8000
}
finally {
  Pop-Location
}
