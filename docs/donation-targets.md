# Donation Targets

Most communities, which are operating services like game servers, use donations in order to cover their monthly cost and expenses.
Such cost can include server rental cost, website operations, software licenses and third-party services, and can easily add up to multiple hundreds of dollars each month.
In order to better communicate to your community that you rely on the donations to provide these services, you can use a feature called donation targets.

## Core Concept

A donation target within the server donation tool is a defined amount of money which you aim to target in a specified timeframe.
The server donation tool allows you to configure this target amount and the timeframe (e.g. monthly) and will add up each donation within the timespan to compare it to the set target.

Currently, the server donation tool supports a recurring monthly donation target only.
It will automatically add up each donation within one month (starting from the 1st of the month at midnight until the end of the month at 23:59), each month from the start again.
You can configure the target of this monthly timespan.

## Setup

To set up a donation target, there is the `donationTarget` configuration key beneath the `app.community` configuration keys.
It takes an object with the required and optional configuration options.

### Configure the donation target

The only required configuration as of now is the donation target itself.
Once set, the donation tool will automatically use the tracked donations to calculate the progress to reach this target.

To configure the target, you need to set the `monthly` configuration key within the `donationTarget` configuration.
The type is a number, which can also take decimals.
If you choose to use a decimal, make sure you use to 2 decimal points.

Example:
```yaml
app:
  # ...
  community:
    #...
    donationTarget:
      monthly: 50.00
```

In this example, a donation target of 50 is configured.
Make sure you do not include a currency, the currency is automatically inferred from your package prices.

Once you restarted the server donation tool, it will automatically show a donation target view on the start page.

### Configure the Discord mirror

Additionally, to the donation target progress view on the donation tool website itself, you can choose to mirror the donation progress to your Discord server.
Once configured, the donation tool will automatically add a message to the configured Discord channel, containing the current donation target progress.
It will also automatically update the message whenever a donation is made.

Caveats:
- Ensure that the configured Discord Bot user is allowed to write to the configured discord channel
  - It needs the permission to create/send messages in the channel
  - It also needs the permission to update its own messages
- Currently, only the last 100 messages are inspected to find the already sent message of the donation tool. Ensure that the channel, where the message is sent, will not exceed this limit, otherwise the donation tool may create a new message, which might not be intended.
  - A good practice is to prevent your community members to write to this channel at all

In order to enable the Discord mirror of the donation target, you need the channel ID of the Discord channel where the message should be written to.
To get this ID, enable the Discord Developer mode in your Discord client (refer to the [Getting Started guide](./getting-started.md), section _Discord Bot user_ to find detailed steps on how to do that).
Then, right-click on the channel you want to write the donation progress message to and click on `Copy ID`.
Write down this ID, you'll need it in the configuration part, which comes next.

The configuration of the discord mirror is done in the same `donationTarget` configuration object as the target itself.
Set the configuration option `discordChannelId` to the ID of the channel you copied before.
Make sure you escape the channel ID with single (`'`) or double (`"`) quotes, as it is a numeric value.

Example:
```yaml
app:
  # ...
  community:
    #...
    donationTarget:
      monthly: 50.00
      discordChannelId: '11111111111111'
```

With this example configuration, the donation tool would mirror the donation target progress as a message into the Discord channel with the ID `11111111111111`.
