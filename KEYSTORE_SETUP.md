# Android Signing Keystore — One-time Setup

The auto-release workflow signs every APK with **the same release key** so each new build installs over the previous one (Android refuses to update an APK signed with a different key). This file walks through generating the key once and storing it as GitHub Secrets.

## 1. Generate the keystore (do this once, on your machine)

Open PowerShell in any directory (the file is sensitive — keep it offline):

```powershell
$keystore = "$HOME\rublicx.keystore"
keytool -genkeypair -v `
  -keystore $keystore `
  -alias rublicx `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storetype JKS `
  -dname "CN=RublicX, OU=Mobile, O=xjanova, L=Bangkok, ST=BKK, C=TH"
```

You'll be asked to set:

- **Keystore password** (e.g. `********`) — both store and key passwords. Use the same one for simplicity.

> **Back this file up to a secure place** (1Password, encrypted USB). If you lose it, future APKs cannot install over the existing one — users would have to uninstall first.

## 2. Encode the keystore as base64

```powershell
$bytes = [System.IO.File]::ReadAllBytes("$HOME\rublicx.keystore")
$b64 = [Convert]::ToBase64String($bytes)
Set-Content -Path "$HOME\rublicx.keystore.b64" -Value $b64 -Encoding Ascii
# Copy to clipboard for easy pasting:
Get-Content "$HOME\rublicx.keystore.b64" | Set-Clipboard
```

The base64 string is now on your clipboard.

## 3. Add 4 GitHub Secrets

Go to https://github.com/xjanova/RublicX/settings/secrets/actions/new and add **each** of these:

| Secret name                   | Value                                                |
| ----------------------------- | ---------------------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`     | Paste the base64 string from your clipboard          |
| `ANDROID_KEYSTORE_PASSWORD`   | The keystore password you set in step 1              |
| `ANDROID_KEY_ALIAS`           | `rublicx`                                            |
| `ANDROID_KEY_PASSWORD`        | Same as keystore password (or different if you set one) |

You can also use the gh CLI (still on your machine):

```powershell
$b64 = Get-Content "$HOME\rublicx.keystore.b64"
gh secret set ANDROID_KEYSTORE_BASE64 -b $b64 -R xjanova/RublicX
gh secret set ANDROID_KEYSTORE_PASSWORD -b "<your-password>" -R xjanova/RublicX
gh secret set ANDROID_KEY_ALIAS -b "rublicx" -R xjanova/RublicX
gh secret set ANDROID_KEY_PASSWORD -b "<your-password>" -R xjanova/RublicX
```

## 4. Trigger the workflow

```powershell
gh workflow run "Build & Release Android APK" -R xjanova/RublicX
```

…or push any change to `main` / `android/**`. The workflow will:

1. Decode `ANDROID_KEYSTORE_BASE64` to a temp file.
2. Bake `versionCode = 100 + run_number` and `versionName = <pkg.version>+<sha>` into the APK.
3. Run `./gradlew :app:assembleRelease` which signs with your release key.
4. Upload `rublicx-<versionName>.apk` as a release asset on tag `v<pkg.version>-build.<run_number>`.

You can watch the run with `gh run watch -R xjanova/RublicX`.

## 5. How users get updates

- On launch, the app calls the GitHub Releases API for the latest tag.
- It parses `versionCode` from the tag (`v0.1.0-build.42` → `100*100+42 = 10042`).
- If newer than the installed code, a **banner** appears with an **Update now** button.
- Tapping it streams the APK from GitHub Releases into the app's `files/updates/` directory while updating a real progress bar (0..100%).
- On 100% the app launches Android's package installer with `ACTION_VIEW` over the FileProvider URI. Because the new APK shares the keystore signature, Android upgrades in place — user data is preserved, no uninstall required.

## Without the keystore

If you skip step 3, the workflow still produces an APK but signed with the Gradle debug key. That APK is fine for local testing but **cannot install over a previously installed release-signed APK** — the in-app updater will fail with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`. Add the secrets before users install the first signed build.
