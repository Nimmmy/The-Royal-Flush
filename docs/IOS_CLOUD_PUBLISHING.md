# iPhone build and publishing feasibility

This isolated branch investigates a cloud build route. It does not change the Netlify production website or publish an app.

## Route

1. Run Xcode on standard GitHub Actions macOS runners in this public repository.
2. Compile an unsigned iPhone archive before buying Apple Developer membership.
3. After the account holder enrolls and accepts Apple agreements, configure a restricted App Store Connect API key, distribution signing certificate and provisioning profile as encrypted CI secrets. Never commit private keys or passwords.
4. Export a signed App Store build on the cloud Mac and upload it with Apple's command-line/API tools. Use TestFlight for testing on the owner's iPhone.
5. Complete App Store metadata, screenshots, privacy/support pages and review submission. Apple determines approval.

## Current proof boundaries

The workflow compiles the existing web application and generates a temporary Capacitor iOS shell with signing disabled. Its remote website URL is solely a toolchain experiment. It is not a production architecture, an installable iPhone build, or proof of App Store eligibility. No Apple credentials, app submission or release are involved. The archive is discarded when the runner finishes; it is not stored as a billable artifact.

A production app should bundle its interface and integrate device capabilities appropriately. It needs native-device testing, deliberate backend connectivity and navigation, privacy declarations, and a complete App Review preparation. The current public contribution model also needs reporting, filtering, blocking of abusive contributors and a response/contact process to address Apple's user-generated-content rules. Do not silently change the live site's contribution model.

## User involvement that cannot be removed

Apple Developer enrollment, identity verification, payment and legal agreements belong to the account holder. Initial account authorization/API-key setup may require their participation and two-factor verification. A personal Mac is not required for the proposed CI route. Signed distribution cannot be verified before access to an enrolled Apple account. Approval by Apple cannot be guaranteed.

## Primary references

- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://capacitorjs.com/docs/getting-started/environment-setup
- https://capacitorjs.com/docs/guides/ci-cd
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api
- https://developer.apple.com/app-store/review/guidelines/#user-generated-content
- https://developer.apple.com/app-store/review/guidelines/#minimum-functionality

## Verified result — September 23, 2026

The unsigned build completed successfully on a standard GitHub-hosted macOS 26 arm64 runner with Xcode 26.6 (17F113). The workflow compiled the existing web application, generated the Capacitor iOS project, and archived an arm64 iPhone executable with code signing disabled. It also verified that Apple's altool upload command is installed. No Apple credentials or paid Apple membership were used, and no archive was submitted or retained as a workflow artifact.

Successful run: https://github.com/Nimmmy/The-Royal-Flush/actions/runs/35819879748

The first attempt exposed extraneous Netlify CLI platform binaries in the existing package lock. The proof workflow removes only extraneous lock entries in the disposable runner before installing. The website's main branch and production deployment are unchanged.

This verifies cloud Mac access and unsigned compilation. It does not verify signing, installation on a physical iPhone, authenticated TestFlight/App Store upload, or App Review acceptance. Those are separate next-stage gates. An App Store Connect Team API key can support automated certificate/profile management and upload; initial key authorization and account-holder tasks remain necessary. The user does not need to purchase or operate a Mac.
