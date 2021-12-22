# Stripe.com

Stripe.com is a payment processor with a wide variety of payment options available.
You can configure available payment options in the Stripe.com dashboard and activate and deactivate payment methods of your choice.

However, while the payment processing should be the same for most of the payments, we suggest to use payment methods which allow an instant payment confirmation, only (such as credit card, giropay, SOFORT, etc.).
While payment methods, where a confirmation might be pending for several hours or days might work just fine as well, they were not tested and may lead in a less optimal flow for your donators.
They might need to refresh the _Donation payment pending_ page multiple times throughout the time until a payment is confirmed.

## Setup

You need to register an account with stripe.com.
Do so by following the registration form on their website: https://dashboard.stripe.com/

You will need to give the account, you want to choose for the donation tool, an account name.
This name will be displayed on the checkout page for the donator when they do a payment.

After creating an account, you need to activate your account on the Stripe.com dashboard.
The steps to complete the activation may be different depending on the country you reside in, but should be pretty straight forward.
Keep in mind, that you can not transfer actual funds from donators as long as the account is not activated.

## Configure Stripe.com

The Stripe.com configuration in the `config.yml` all reside in the `stripe` key:

```yaml
stripe:
  # The secret key of your stripe.com account (Developers -> API Keys -> Secret Key).
  secretKey: sk_...
```
