# Snapchat Conversions API Tag for Google Tag Manager Server Container

Snapchat conversion API tag for Google Tag Manager server container allows sending site or app events and parameters directly to Snapchat server using [Snap Marketing API](https://marketingapi.snapchat.com/docs/#introduction).

### There are three ways of sending events:

- **Standard** - select one of the standard names.
- **Inherit** from the client - tag will parse sGTM event names and match them to Snap standard events.
- **Custom** - set a custom name.

Snapchat CAPI tag automatically normalized and hashed with lowercase hex SHA256 format. All user parameters (plain text email, mobile identifier, IP address, and phone number).

Tag supports event deduplication.

### Getting started
According to Snap Marketing API, it is required to use Access Token to send events to Snap server. Access Tokens are short-lived. When the Token expires, Snapchat sends a 401 error. It is necessary to renew Access Token using Refresh Access Token and send the request again.

We will handle Refresh Access Token for you using Firebase if you use stape hosting. You'll need to [create Google Service Account and connect it to the stape.io account](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager#4-google-service-account).

### To use this tag, you'll need:

- [Snapchat pixel](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager#1-snapchat-pixel)
- [Snap OAuth App](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager#2-o-auth-app)
- [Client ID and Client Secret](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager#3-client-id-and-client-secret)
- [API Refresh Token](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager#6-api-refresh-token)

## How to use Snapchat tag

- [How to set up Snapchat Conversion API using server Google Tag Manager](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager)

## Open Source

Snapchat Tag for GTM Server Side is developing and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
