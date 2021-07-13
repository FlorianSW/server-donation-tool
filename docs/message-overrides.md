# Customising messages

The donation tool is prepared to use translations instead of english texts, only.
The same system, that allows these translations in the future, can be used to overwrite specific texts in the tool with your own text.
This comes in useful, when you have the requirement to show specific information at specific steps, or want to further customise the UI to your community.

## Overwriting message keys

The donation tool uses a system of unique message keys, that are assigned to an individual place within the application.
This key has a default message assigned, which will then presented to the user as the visible text.
In order to customise/change a specific message in the tool, you simply overwrite the corresponding message key.

### Prepare overwriting message keys (one-time only)

Follow these steps to enable message overwriting:

1. Copy the `string_overrides.example.yml` file (in the root of the donation tool)
2. Paste it to the root of the donation tool (next to the example file)
4. Rename the file to `string_overrides.yml`

That's it.
When you restart the tool the next time, it will use the defined overrides.

### Specifying an override

To override a specific key, e.g. the one which shows the title when the donator opens the website (`Donate`), do the following:

1. Identify the key to overwrite (more details below), in this case, the key is `INFO_TITLE`
2. Add this key to the `messages` object of the `string_overrides.yml` file
3. Define the new value, e.g. `My own text`
4. Save the file and restart the tool

The resulting file should look like this:
```yaml
messages:
  INFO_TITLE: My own text
```

## Identifying the message key

You can find all available/used message keys in the `src/translations.ts` file (see the `messages` object).
Alternatively, given you know exactly the position/place of the message you want to edit, do the following:

1. Open the `config.yml` file
2. Add the `language` key to the app object and use the value `qqx` (see a full example below)
3. Restart the application
4. Open the website
5. All messages should now, instead of showing their assigned texts, the message keys
6. Navigate to the position of the message you want to overwrite and use the message key (inside the curly brackets)
7. Once you're done, don't forget to delete the `language` configuration option and restart the app again

Example config with the `language` property:
```yaml
app:
  port: 8080
  sessionSecret: SOME_SECRET
  sessionStore:
    filename: ./sessions.sqlite
  compressResponse: true
  language: qqx # <- This is what you're looking for
```

The message key you see will also optionally contain a list of parameter names passed to the message.
When overwriting the message key, you can use these parameters as well, simply put them at the position you want them with: `{{paramName}}`.
Where `paramName` is the name of the parameter you want to reference.
