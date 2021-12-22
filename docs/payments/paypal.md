# Payment provider: PayPal

PayPal.com is a supported payment processor for the donation tool. It is used to process a donation payment to transfer funds from the donator to your community.

## Setup PayPal account

To automatically process a transaction from a donator, you need to register a REST Api app in the PayPal developer portal.
Do so by following these steps:

* Open the [developer.paypal.com](https://developer.paypal.com/) page in your internet browser
* Login by clicking the top right `Login to dashboard` link and use your PayPal login credentials
* You should see your dashboard with an overview of your apps and credentials
* In the `REST Api apps` section, click the `Create App` button
    * You can choose between an app on the sandbox partition of PayPal, in order to test out this tool before using it
    * In order to process donations of your donators, you need an app in the `Live` partition of PayPal (you can switch with the buttons under the `My apps & credentials` title)
* Open the apps overview page by clicking on the apps name
* Note down the `Client ID` and the Secret value, you'll need these values in the "Configuration"

## Configure PayPal

The PayPal configuration in the `config.yml` all reside in the `paypal` key:

```yaml
paypal:
  # The environment of PayPal which match to the credentials you configure in the next settings. If you use sandbox
  # credentials, use 'sandbox', if you use live credentials, use 'production'.
  # Allowed values: sandbox, production
  environment: sandbox
  # The access credentials of your PayPal application to process payments. You can either use the sandbox credentials
  # to test the application. In order to process real funds, you need to have a paypal business account and use
  # credentials of a live app.
  # You can create these in the PayPal developer portal: https://developer.paypal.com/developer/applications/
  clientId:
  clientSecret:
```
