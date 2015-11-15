account is the new Nouse accounts system which will provide single sign on (SSO) across Nouse sites and services using Google accounts.  It was created to allow comments from user who we could verify the email address for and require terms and conditions be accepted.

It uses Node.js as a server, with Express and Jade to provide HTML pages using Bootstrap for extra styling.  Authentication is done using Passport and the passport-google-oauth strategy.  An extra package is used to store session data in a MySQL database so that sessions can persist between server restarts and remove the need to keep all active sessions in RAM.

## Using the server
To get the server to run after cloning you'll need to run `npm install` to install the project dependencies.  You'll then need to copy config.js.sample to config.js and set the required values.

Sample config files are provided to prevent revealing the keys used to encrypt data and access APIs for third parties.