#!/bin/bash

export PATH=/usr/local/bin:$PATH
export NODE_ENV=development # app.get('env')

if [ ! -f "package.json" ]; then
	if [ -d "/vagrant-account" ]; then
		cd /vagrant-account
	fi
fi

npm install
forever start server.js
