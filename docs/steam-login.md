# Steam Login

By default, donators using this donation tool needs to login with Discord.
While this method is sufficient for most cases, it requires that the donator links their Discord profile with their Steam account when they want to donate for a package that contains a priority queue perk.
That is, as this perk needs to know the player identity which is used by the Game server as well, which is not Discord but mostly Steam.

If a server hoster does not want to require their donators to connect their Steam account with their Discord profile, they can setup an additional login method with Steam.
Doing so will enables two main features:

* Given the Discord profile does not have a Steam account connected, the donator can additionally login with Steam for the donation tool to get the required Steam account information
* The donator can change for what Steam account they donate for (this allows to, e.g., use another account then linked with Discord)

## Pre-requisites

In order to be able to setup Steam login for the donation tool, you need to create a Steam API key.
You can do that on the [Steam WebAPI Key registration page](https://steamcommunity.com/dev/apikey).
If you already have a key there, you can not create a second one.
Simply use the one which you see there already.

## Configuration

The configuration is straight forward and done in the `config.yml` file.
In the `steam` object (see the `config.example.yml` file as a reference) you need to add the following keys:
```yaml
steam:
  redirectUrl: http://localhost:8080/auth/steam/callback
  realm: http://localhost:8080
  apiKey: Your-Steam-Key
```

The redirect URL corresponds to the same one as for the Discord login (`discord.redirectUrl` key), but ends on `/auth/steam/callback`.
Adjust the example value above accordingly.
The realm value basically is your domain where the donation tool is hosted under.
Insert your API key from the Steam website into the `apiKey` property.
