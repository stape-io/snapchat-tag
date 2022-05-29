# Snapchat Conversions API Tag for Google Tag Manager Server Container

Snapchat conversion API tag for Google Tag Manager server container allows sending site or app events and parameters directly to Snapchat server using [Snap Marketing API](https://marketingapi.snapchat.com/docs/#introduction).

### There are three ways of sending events:

- **Standard** - select one of the standard names.
- **Inherit** from the client - tag will parse sGTM event names and match them to Snap standard events.
- **Custom** - set a custom name.

Snapchat CAPI tag automatically normalized and hashed with lowercase hex SHA256 format. All user parameters (plain text email, mobile identifier, IP address, and phone number).

Tag supports event deduplication.

### Getting started
According to Snap Marketing API, it is required to use Access Token to send events to Snap server.

### To use this tag, you'll need:

- [Snapchat pixel](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager#1-snapchat-pixel)
- [API Token](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager)

## How to use Snapchat tag

- [How to set up Snapchat Conversion API using server Google Tag Manager](https://stape.io/blog/snapchat-conversion-api-using-server-google-tag-manager)

## Open Source

Snapchat Tag for GTM Server Side is developing and maintained by [Stape Team](https://stape.io/) under the Apache 2.0 license.
