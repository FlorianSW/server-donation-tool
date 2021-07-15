# Packages and Perks

The donation tool is composed out of different package options, which grant a possible donator access to a variety of freely configurable perks.

## Understanding Packages and Perks

The concept of packages and perks is a core concept of the donation tool.
It is not only the main part the donator will interact with during the donation process.
It is also the key element for server hosters to individualise what they offer to donators and what donation amount they expect.

### Package

A package in the donation tool can be seen as a container.
It holds the information of a unique ID, in order to reference the package during the donation process, as well as afterwards (e.g. in case of a refund or issue).
The package will also has a price tag, which a donator will need to pay.
The most important part of a package is a collection (0 or more) of perks, that a donator gets access to when a donation was successful.

#### Packages with a variable price

The default setting for a package is, that it has a fixed price tag.
That means, a donator can select the package in order to earn the perks of it, but has to donate the fixed amount of money the server hoster defined as a price.
Alternatively, the type of the package (with the `type` parameter in the price object) can be `VARIABLE`.
Setting the price to variable allows your donators to donate an amount they see as appropriate, starting from any positive value greater than 0 (even 0.01).

This feature is intended to support packages where you want your donators to donate less amounts then your pre-packages allow.
However, keep in mind that the donators will still earn the perks configured for the package, for whatever price they choose, even one cent only.

To configure a package with a variable price, which will grant the donator a role in the discord, use this example:

```yaml
packages:
  - name: 'Perk #1'
    id: 1
    price:
      type: VARIABLE
      currency: USD
      amount: '1.00'
    perks:
      - type: DISCORD_ROLE
        roles:
          # Donator
          - '0000000000000'
```

The `amount` in the `price` object will be used as a default value in the tet field, which a donator can change.

### Perk

A perk is a single _item_ a donator will be granted when a donation for a package was successful.
The perk can grant access to basically everything, depending on if there is an integration/automation provided already.
Built-in perks are listed down below in this help article for reference.

Each perk, from a point of view of a server hoster, may require different configuration options.

## Configuring Packages

Donation Packages can be configured in the `config.yml` configuration file in the `packages` key.
It is a list of objects, e.g.:
```yaml
packages:
  - name: 'Perk #1'
    id: 1
    price:
      currency: USD
      amount: '1.00'
    perks:
      - tpye: FREETEXT_ONLY
        text: Some text to show to the donator
  - name: 'Perk #2'
    id: 2
    price:
      currency: USD
      amount: '1.00'
    perks:
      - type: PRIORITY_QUEUE
        amountInDays: 30
        cftools:
          serverApiId:
```

Each package has the following metadata:

* **name**: The name of the perk as shown to the donator in various views: The package selection view when a donation starts, as well as on the PayPal receipt.
* **id**: A numeric ID to uniquely identify the package in the list of packages _over time_.
  This ID shall _not_ be re-used for other packages in the future.
  Simply count up this number by one whenever you create a new package, without repeating already used ones.
* **price**: An object of price information, containing the `currency` and `amount`.
  The `currency` must be one of [the supported ones from PayPal](https://developer.paypal.com/docs/reports/reference/paypal-supported-currencies/).
  Donators will still be able to donate in their preferred currency, if supported by PayPal.
  You will, however, get the amount exchanged to the currency listed here.
* **perks**: A list of perks the package includes.
  Each perk consists of a required `type` parameter and additional configuration, depending on the perk type (see the available perks in the list below)

## Built-in available Perks

The following perks are available built-in.

### Priority Queue

The priority queue perk works together with CFTools Cloud.
If included in a package and redeemed by a donator, the perk will setup a priority queue slot for a single configured CFTools Cloud server..
The priority queue slot will last as long as configured.

This perk, in order to work correctly, requires the CFTools Cloud application the be setup.
Please see the Getting Started guide, section "Setup dependent accounts" -> "CFTools", to get more information on how to do that.

If you want to grant priority queue access to multiple servers for a package, you may want to configure multiple priority queue perks for that package.

#### Available configuration options

**Type**: `PRIORITY_QUEUE`

This perk requires the following additional configuration options:

* **amountInDays**: A number with the amount of days the priority queue slot should be setup for.
  E.g. `30` for 30 days, or `14` for 14 days and so on.
* **cftools**: An object of required information to work with CFTools Cloud.
  The only required parameter for now is `serverApiId` which is the `Server Id`.
  You find this ID in the server you want the Priority Queue setup for.
  Go to Manage -> Settings and look into the `API Key` section.

### Discord role assignment

This perk will assign a set of Discord roles to the logged in discord user when a donation was successful.

To get the required Discord role ID of the roles you want to get manager, you need to enable the developer mode in your discord app.
Then, right-click on the role you want to grant in the role management of the server settings and click copy.

#### Available configuration options

**Type**: `DISCORD_ROLE`

This perk requires the following additional configuration options:

* **roles**: A list of strings (not numbers, so please quote the IDs from Discord with ') of the Discord roles you want to give to the donator.

### Free text

This perk is intended to cover cases, where your donators will receive perks in other, maybe even non-automated, ways.
In order to still advertise that donators will get these perks when they donate, you can use this free text perk.

When a donator redeems this perk, it will basically do nothing.

#### Available configuration options

**Type**: `FREETEXT_ONLY`

This perk requires the following additional configuration options:

* **text**: The text to show to the donator on the package selection page.
