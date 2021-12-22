# Subscriptions

Subscriptions is a feature of donation packages, which help donators to donate to a community in a regular, automated manner.
When enabled for a package, a donator can subscribe to that package.
The price of the package will then be charged to the PayPal account of the donator (which was used to subscribe to the package).
Also, the perks included in the package will automatically be redeemed on the behalf of the donator.

Subscriptions are currently supported by the following payment providers:
* PayPal

## Setup of Subscriptions

To enable the subscriptions feature for a specific package, you simply need to set the billing cycle for that package, using the `subscription` configuration key, e.g.:

```yaml
packages:
  - name: 'Perk #1'
    subscription: monthly
    id: 1
    # ...
```

As of now, the only available billing cycle for package subscriptions is `monthly`.

Once you restarted the donation tool, it will automatically do the one-time setup.
Once this process is finished, the packages with the `subscription` property set will be available for donators to subscribe to.

## Detailed information

The subscriptions feature heavily relies on the PayPal Webhook feature.
For that feature to work, the donation tool needs to be registered as a Webhook target within the PayPal developer portal.
The donation tool will attempt to automatically setup this webhook on your behalf.
In order for this Webhook to work, the donation tool requires to run with https enabled, as well as on the default port for https websites (443).
