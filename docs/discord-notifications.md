# Discord notifications

The server donation tool is helping your donators to donate to your community and get rewards for that quicker and in a
self service without you getting involved in this process. However, that also means, that you loose insights in what
packages your donators like to donate for and how many donations you get. You could use the PayPal transaction history
for that, however, it might contain donation-unrelated charges and incoming funds as well, which makes this approach not
feasible. Additionally, a pure transaction history does not give you insights into possible problems that may occur when
a donator redeems the perks of a package.

Discord notifications is an optional functionality of the server donation tool to help you gather all these insights
easily.

## Core concept

You can configure the server donation tool to send a notification to one or more discord channels with all required
information for the specified event. The notification is sent to the configured Discord webhook. Webhooks are an easy to
setup way to send arbitrary messages to a Discord channel. See the
official [webhook documentation](https://support.discord.com/hc/en-us/articles/228383668-Einleitung-in-Webhooks) in the
Discord documentation to find out more.

## Setup

### Available notification types

The following notification types are currently available in the tool. Please also ensure you send the message contents
to appropriate channels. For example, notification types that contain personal identifiable information are most likely
not supposed to be published into a public channel.

You can configure multiple notifications, which take different (or even the same) notification types.

<table>
    <thead>
        <tr>
            <th>Type</th>
            <th>Event</th>
            <th>Information</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>DONATED</td>
            <td>A donator successfully donated (donation is processed and confirmed by PayPal).</td>
            <td rowspan="3">Order ID, PayPal Order ID, PayPal Transaction ID, Donator Discord and Steam ID, Donated for package, Order creation date</td>
        </tr>
        <tr>
            <td>SUCCESSFUL_REDEEM</td>
            <td>A donator redeemed the perks of a package. This notification can be sent multiple times for a single donation.</td>
        </tr>
        <tr>
            <td>REDEEM_ERROR</td>
            <td>A donator tried to redeem perks for their package and there was an error. This notification might occur multiple times for the same donation, one for each errored perk.</td>
        </tr>
        <tr>
            <td>SUBSCRIPTION_ACTIVATED</td>
            <td>A donator subscribed to a package.</td>
            <td rowspan="2">Subscription ID, Subscription Plan ID, PayPal Subscription ID, PayPal Plan ID, PayPal Product ID, Donator Discord and Steam ID, Package the donator subscribed to</td>
        </tr>
        <tr>
            <td>SUBSCRIPTION_CANCELLED</td>
            <td>A donator cancelled a subscription.</td>
        </tr>
        <tr>
            <td>SUBSCRIPTION_EXECUTED</td>
            <td>A payment was made as part of a recurring subscription. This event will come together with the `SUCCESSFUL_REDEEM` event.</td>
            <td>Subscription ID, Subscription Plan ID, PayPal Subscription ID, PayPal Plan ID, PayPal Product ID, Order ID, PayPal Order ID, PayPal Transaction ID, Donator Discord and Steam ID, Package the donator subscribed to</td>
        </tr>
    </tbody>
</table>

### Preparation

In order to configure the notifications, you need to first create an incoming webhook URL for the channel(s) where you want to receive discord notifications.
See the discord [webhook documentation](https://support.discord.com/hc/en-us/articles/228383668-Einleitung-in-Webhooks) to find more info on how to do that.
Write down the webhook URL(s) for the next steps.

### Configure the notifications

Open the `config.yml` file in your favourite text editor.
Find the configuration key `discord` and check if there is a child-key named `notifications` already.
If not, create one.
Your configuration should now look similar to this one (unnecessary parts are removed):

```yaml
# ...
discord:
  # ...
  notifications:
# ...
```

You can now add one configuration block per unique webhook URL (one webhook URL per channel) with the following options:
- **webhookUrl**: The Discord webhook URL where the notifications should be sent
- **types**: A list of notification types to sent to this channel (see the list above)

For example, you may want to configure something similar to:

```yaml
# ...
discord:
  # ...
  notifications:
    # Might go to #donation-feed
    - webhookUrl: https://discord.com/webhook/...
      types:
        - DONATED
        - SUCCESSFUL_REDEEM
    # might go to #donation-errors
    - webhookUrl: https://discord.com/webhook/...
      types:
        - REDEEM_ERROR
# ...
```
