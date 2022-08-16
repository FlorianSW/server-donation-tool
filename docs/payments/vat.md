# Value-added tax (VAT)

Depending on your country of residency, your own tax model and other factors, you may be required to pay taxes for donations you receive through the donation tool website.
Please consult with your tax consultant in order to check your requirement to collect taxes for donations.
It is out of scope of this documentation to elaborate on the need to collecting taxes.

The server donation tool supports collecting taxes for european countries as of now.
To get the current tax rates for EU countries, the tool uses [VATStack](https://vatstack.com/).
You need to register with them before you can enable tax support in the donation tool.
The developer plan should generally be enough, however, check for individual requirements before selecting the plan.

Once done, simply enable tax support in the configuration:

```yaml
vats:
  enabled: true
  vatStack:
    publicKey: pk_...
```

While the value of `publicKey` is the value of your public API key from the [VATStack dashboard](https://dashboard.vatstack.com/keys).
Restart the server donation tool and it will start collecting taxes for your european donators.

In order to collect the correct tax rate from your donators, the donation tool will ask the donator about where they live.
