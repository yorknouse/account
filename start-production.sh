#!/bin/sh

export PATH=/usr/local/bin:$PATH
export NODE_ENV=production # for app.get('env')
forever start server.js
