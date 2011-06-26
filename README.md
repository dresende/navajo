# Navajo HTTP Server

The purpose of this project is to create a small and simple web server with some
of the most common features of the Apache2 server. For now it's not really usable.

This is still experimental!

## Features

- Apache2 log format (most common I think)
- Ability to use logrotate (kill -USR1 will force logs to be reopened)
- Virtual hosting
- Run javascript on the server

## Features Planned

- Ability to have specific configuration for specific folders
- Use Connect/Cluster to use all server cores
- Have WebSocket available for javascript running on the server, out of the box
- Simple API for the files running on the server