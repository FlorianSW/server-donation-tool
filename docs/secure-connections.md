# Serving the donation tool website using a secure connection (https)

The donation tool handles some sensitive information, like personal data from your donators, and more importantly, your donators are asked to use PayPal to process a payment.
Even though these information are not send directly from the client to the server, some identifiers are, and, of course, the fact that your donators are using the website.
It therefore makes sense to protect this information when they get transferred to your server.
When you do not configure serving traffic via https, browser may also mark your website as "Not secure" when donators open it.
To do so, you may want to setup to serve the donation tool website with https using a reverse proxy.

As of this guide, we will use the following components:

* nginx as a reverse proxy web-server
* [Let's Encrypt](https://letsencrypt.org/) to automatically obtain and renew a free certificate for your domain
* Windows as an operating system, it should not differ much when using a Linux/MacOS operating system, though

However, you can use whatever webserver or certificate provider you are most familiar with.
You may even buy a certificate from a certificate authority of your choice.

When using nginx as a webserver and following this guide, please make sure you stop all existing and still listening webservers that listen on port 80 or 443 (or make them listen on other ports).

## Setup of nginx (the reverse proxy webserver)

* First, make sure you configure the donation tool to listen on another port than 80 or 443, usually you would take 8080, if this one is still unused on your server
  * You do not (and _should_ not) whitelist this port in your firewall, it is expected to be not reachable from the internet in this configuration scenario, nginx will serve traffic from the donation tool via traffic through localhost
  * If you choose another port than 8080, make sure you change the port in the `nginx.conf` (see later)
* Download mainline for Windows from [nginx.org](http://nginx.org/en/download.html)
* Extract the contents (conf, contrib, etc) into the directory of your choice, for this guide we'll use `D:\nginx`
* Open a terminal window ([Win] + [R] -> `cmd` -> [Enter])
* Navigate to the directory `D:\nginx`: `cd D:\nginx`
* Start nginx: `start nginx.exe`
* Copy the example config `nginx.conf` (within the directory of this guide) to the `conf` directory inside the extracted nginx directory
* Open the configuration file and change the `server_name` property to your domain name
* Reload the configuration of nginx: `.\nginx.exe -s reload`
* Verify that you can open your domain name in the browser, e.g.: http://example.com/.well-known/ (it should respond with a 404 - Not Found)

## Setup of certbot for issuing a certificate

Certbot is a tool that interacts with Let's Encrypts ACME procotol to automatically:
* Create a private key
* Create a certificate request (CSR) for your domain
* Let Let's Encrypt validate that you own your domain
* Issue the certificate

In order to do that and to _install_ the certificate into nginx, follow these steps:

* Download certbot from [their website](https://certbot.eff.org/lets-encrypt/windows-nginx)
* Open a new command line window with administrator privileges ([Win] + [R] -> `cmd` -> right click on command line -> Run with administrator privileges)
* Run the following command: `certbot certonly --webroot` and follow the questions on the screen
  * Enter an e-mail address (it does not be one of the domain you want to have a certificate for)
  * Read and accept the terms of service (by pressing Y)
  * Decide if you want to share data with the EFF, which is not a requirement for the certificate creation process
  * Enter the domain name for which you want to run the donation tool, e.g.: donate.example.com
  * Enter the following path for the webroot: `D:\nginx\html\`
  * The certificate should be created successfully
  * You can now close this administrator command line
* Open the directory `C:\Certbot\live\yourdomain` (replacing `yourdomain` with your domain), it should contain some files like `cert.pem`
* Go back to the configuration file of nginx (`nginx.conf`) and uncomment the last server block (the lines with `#`), remove only the hashtags from the beginning of the line
* Locate the configuration option `ssl_certificate` and replace `cert.pem` with the following value: `C:/Certbot/live/yourdomain/fullchain.pem`, replacing `yourdomain` with your domain
* Locate the configuration option `ssl_certificate_key` and replace `key.pem` with the following value: `C:/Certbot/live/yourdomain/privkey.pem`, replacing `yourdomain` with your domain
* Go back to the command line and execute the following command: `.\nginx.exe -s reload`
* Open the domain name in your browser, it should automatically redirect to https:// and serve the donation tool

## Configure automatic certificate renewal

Certificates from Let's Encrypt expire after a short period of time, currently 90 days.
This is an intended short lifetime, in order to ensure that certificates rotate often [for several reasons](https://letsencrypt.org/2015/11/09/why-90-days.html).

Certbot will automatically install a scheduled task to renew your certificates before they expire.
However, it can not know what to do in order to _install_ the certificates correctly, after they get renewed.
For that, you need to adjust the command so that it will automatically reload the configuration of nginx:

* Open the "Scheduled task" manager of Windows
* Locate the "Certbot Renew Task" scheduled task
* Open it by double clicking on it
* Navigate to the "Actions" tab
* Select the only action inside there and press "Edit"
* In the "Arguments" input field, add the following content _after_ `certbot renew` but before the last `"`: `--deploy-hook 'D:\nginx\nginx.exe -s reload'`
* Save the changes by clicking on OK
