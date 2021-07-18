# Getting Started Guide

Using this tool to convert a manual donation process to a self-service experience requires some steps.
This guide aims to translate the documentation of the single configuration options in the `config.example.yml` configuration file to an actionable step-by-step guide to get started with an initial setup.

This guide sets up the donation website in a basic, working fashion.
You still might want to take a look into more advanced setup scenarios (see more documentation pieces in the docs folder).

## Pre-requisites

To install this donation tool has the following minimum requirements:

* A Windows, MacOS or Linux operating system
* some basic knowledge using a terminal/shell
* some basic knowledge using yaml/a text editor
* [NodeJS + npm](https://nodejs.org/en/download/) installed
* a [PayPal business account](https://developer.paypal.com/developer/accountStatus) (to process payments)
* a [Discord account](https://discord.com/)
* (Optional) a [CFTools Cloud](https://cftools.cloud/) account and registered server (needed when offering a priority queue perk)
* (Optional) a [Discord server](https://discord.com/) (needed when offering a Discord roles perk)
* A domain is highly recommended, however, opening the website using the computers/servers IP address works fine as well

## Installation

**Note**: The guide will use command syntax as it is used on Windows operating systems.
You may need to translate/convert the commands to be used on MacOS or Linux systems.

Installing the donation tool is the first step you should do.
For that, you need to download the source code of the application itself.
You can either use [git](https://git-scm.com/) to clone the repository, or alternatively download the [latest version](https://github.com/FlorianSW/cftools-server-donation/archive/refs/heads/main.zip) as a zip file.
Clone or unzip the files to a directory of your choice.
As of in this guide, the location of the source code will be referred as `C:\apps\cftools-server-donation`.

### Installing dependencies

After downloading the source code, you need to get the dependencies used by the donation tool.
For that, open a new Terminal window:

* press [WIN] + [R]
* type `cmd`
* hit [ENTER]
* Navigate to the downloaded source code: `cd C:\apps\cftools-server-donation`
* Install dependencies: `npm ci` (this may take a bit of time depending on your internet connection)

## Setup dependent accounts

### PayPal

PayPal is the payment processor used by this donation tool.
To automatically process a transaction from a donator, you need to register a REST Api app in the PayPal developer portal.
Do so by following these steps:

* Open the [developer.paypal.com](https://developer.paypal.com/) page in your internet browser
* Login by clicking the top right `Login to dashboard` link and use your PayPal login credentials
* You should see your dashboard with an overview of your apps and credentials
* In the `REST Api apps` section, click the `Create App` button
  * You can choose between an app on the sandbox partition of PayPal, in order to test out this tool before using it
  * In order to process donations of your donators, you need an app in the `Live` partition of PayPal (you can switch with the buttons under the `My apps & credentials` title)
* Open the apps overview page by clicking on the apps name
* Note down the `Client ID` and the Secret value, you'll need these values in the "Configuration" section

### Discord login

The donation tool requires a login through discord.
I choose this login method, as most gaming communities will already have a discord server, which is connected to their community and therefore accepted the most.
To setup this loign through Discord, you'll need to create an application in the developer portal of Discord.
To do so, follow these steps:

* Open the [Discord developer portal](https://discord.com/developers/applications) in your internet browser
* Create a new or open an existing application
* Navigate to the application by clicking on the name
* On the left side, open the `OAuth2` section
* Note down the `CLIENT ID` and `CLIENT SECRET` values, you'll need these values in the "Configuration" section
* In the Redirects list of URLs, add a new URL and put in your redirect URL
  * The redirect URL consists of the Domain you own (e.g. example.com), or the IP address of the server, whatever you choose
  * It needs to be the domain/URL your donators will use to access the donation tool website later on (including the correct protocol, like http/https)
  * Additionally, add `/auth/discord/callback` to it
  * The full redirect URL might look like: `https://example.com/auth/discord/callback`
* Save the changes and continue

### CFTools

**Note**: If you do not want to offer a Priority Queue perk, you can skip this section.

You may use CFTools Cloud to manage and grant priority queue access to your donators and want to use this donation tool to make the whole process of donating and setting up the priority queue an automatic self-service experience.
For that, this donation tool requires some grants to manage the priority queue entries on your behalf.
As for Discord and PayPal, this is done by setting up a developer application, which you can setup using the following steps:

* Open the [CFTools developer portal](https://developer.cftools.cloud/applications)
* Create a new application (or use an existing one)
* Open the application by clicking on it
* Note down the `Application Id` and `Secret` value, you'll need these values in the "Configuration" section
* Copy the `Grant URL` and open it in a new browser tab/window
* Login to your CFTools account if requested
* You'll see a list of resources you have access to, which you can grant access to for the new application
* Select at least the server resources where you want to offer priority queue perks for
* Click the `Grant access` button to grant the access

### Discord Bot user

**Note**: If you do not want to offer a Discord role perk, you can skip this section.

In order for this donation tool to be able to redeem discord role related perks (granting the donator a specific role in your discord sever), it needs additional permissions and setup.
You need to create a bot user, which is invited into the discord server you want to have the roles assigned to donators.
You can setup the bot by following these steps:

* Open the [Discord developer portal](https://discord.com/developers/applications) in your internet browser
* Open the app you created in the "Discord login" step
  * You could also create a new application to separate the login from the role management if you want to
* Click on the `Bot` section in the left side navigation
* If not already done: Add a bot user to your application by clicking the `Add Bot` button
* Copy the value `TOKEN` and note it down, you'll need this value in the "Configuration" section
* Scroll down to the `Privileged Gateway Intents` section
* Enable the `SERVER MEMBER INTENT` by switching the toggle to on
* Click on the `OAuth2` section in the left side navigation
* Scroll down to the `OAuth2 URL Generator` section on that page
* Select the `bot` scope in the `SCOPES` selection list
* In the `BOT PERMISSIONS` list under the `SCOPES` list, select at least the `Manage Roles`
  * You may also choose to grant the `Administrator` permission if you like, however, this is not really needed and you should avoid granting permissions to bots and identifies when they do not need them
* Copy the URL at the bottom of the `SCOPES` list and open it in a new browser tab/window
* Select the Discord server where you want to have roles managed by the donation tool and click `Authorize`

In addition to the bot setup itself, you'll need the Guild ID of the Discord server where you just added your Discord bot to.
To retrieve this ID, follow these steps:

* Open your Discord app click on the little cog item next to your user in the bottom left
* Go to the App Settings -> Advanced section
* Enable the developer mode
* Go back to the main Discord view (with all your servers)
* Right-click on the server you want to have managed by this donation tool
* Click `Copy ID`
* Paste this ID somewhere and note it down, you'll need it in the "Configuration" section

## Configuration

You're now set and should have all the required information to configure the donation tool and start it up the first time.
To configure the tool, follow these steps:

* Copy the `config.example.yml` file to `config.yml` in the root directory of your source code (`C:\apps\cftools-server-donation`)
* Open the `config.yml` file in your favourite text editor (preferably one which supports YAML syntax highlighting which will greatly improve your ability to change the config)
* You should now go through each of the configuration options and fill them out with the information you gathered above
* If you do not have a value for one of the configuration, remove it, or keep the default value, if it has one
* Also, take a look into the comments of the configuration option, which may give additional details and context to what this option does and if you should change it

## Start the tool

Once you've done the above setup and steps, you can go ahead and start the donation tool.
For that:

* press [WIN] + [R]
* type `cmd`
* hit [ENTER]
* Navigate to the downloaded source code: `cd C:\apps\cftools-server-donation`
* Start the tool: `npm start`
* It will now be served from the configured port :)
