#REST Output

The REST output is deceptively simple: you can use it to talk to a very large number of REST endpoints, with very little configuration.

![Rest output config](img/rest-output.png)

Number of Fields: input the number of data elements that will be used to build the “Server URL” below.

Server URL: using the simple “tag” syntax explained below this field, you can design the structure of the URL that will be called or posted to.

Do a GET or POST: as it says, you can select whether to GET or POST to the URL above.

##Notes on development

As it stands today, this plugin is already very useful. Future development of Wizkers might include additional predefined tags such as current time, GPS location and others, that can be combined with instrument outputs to build more complex calls. Contributions are welcome!