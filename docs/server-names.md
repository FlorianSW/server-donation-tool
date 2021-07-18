# Human-readable server names (CFTools)

Your community members most likely know the servers your community provides under specific names.
These names are, by default, be some strings unknown to the donation tool.
Because of that fact, the tool will use the CFTools Server ID on the website whenever a specific server in CFTools is referenced.

In order to make the tool show your specific server names instead of the Server IDs, you can use a configuration option in your `config.yml`.
The `serverNames` configuration option is a map which maps the CFTools Server ID to the name of your server as your donators will recognize them.

For example, let's suppose your community operates two DayZ Servers with the following data:
Name: My Awesome Server 1
Server ID: 123-456-789

Name: My Awesome Server 2
Server ID: 987-654-321

You can configure the `serverNames` mapping as follows:
```yaml
serverNames:
  123-456-789: My Awesome Server 1
  987-654-321: My Awesome Server 2
```

The donation tool will, once you restarted the tool, then use the names, `My Awesome Server 1` and `My Awesome Server 2`, in the visible parts of the website.
