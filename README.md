account is the new Nouse accounts system which will provide single sign on (SSO) across Nouse sites and services using Google accounts.  It was created to allow comments from user who we could verify the email address for and require terms and conditions be accepted.

It uses Node.js as a server, with Express and Jade to provide HTML pages using Bootstrap for extra styling.  Authentication is done using Passport and the passport-google-oauth strategy.  An extra package is used to store session data in a MySQL database so that sessions can persist between server restarts and remove the need to keep all active sessions in RAM.  SendGrid is used for email functionality, for a small site the 12,000 free messages/month account should suffice.

## Using the server
To get the server to run after cloning you'll need to run `npm install` to install the project dependencies.  You'll then need to copy config.js.sample to config.js and set the required values.

Sample config files are provided to prevent revealing the keys used to encrypt data and access APIs for third parties.

If the terms file is being included within the directory structure then the filename terms.inc has been reserved for it.  The terms file should be a HTML fragment with only the terms in it (there should be not doctype, html, head or body tags).

## Login and Authentication
There are two ways in which authentication takes place: with the external site to verify the user, and with the site the user wants to access.
### External login
Login is provided by Google.  When a user attempts to log in for the first time an account is created for them based on the profile used by the external account.  This will always take their full name and email address, and store the data with their new account.  Separate tables in the database handle linking their account with an external provider.

The user will then need to accept the presented terms and conditions before being able to continue.  Any user who has not accepted the terms and conditions will always be directed to an acceptance page.

### Internal login
Internal login is provided by the /auth section.  This will allow login to a site with a given protocol, hostname and port, provided it has an API key and the requested hostname matches those given in the URLs list for that API key.  Currently authentication is done using Javascript and postMessage, which purely provides confirmation to the requesting page that a login has succeeded and that it should now reload.

## User operations
At /account a user can modify their nickname.  They are also presented with a logout button.  Users wishing to modify other settings, such as name, email, or to delete their account are required to contact support via email.

## Administrator Access
Currently the only way to provide administrator access to the first admin user is to set a users activated level to 9 manually in the database.  To access the admin interface visit /admin.  There is also an option shown on the account page for administrators.

### Users
This allows control of all users, including editing information and suspending/deleting users as needed.  Administrator access can also be set if needed for additional admin users.  Email verification requirements can also be overridden if needed.  Account creation must be done by the user however.

### Sessions
This allows logged in users to be viewed and sessions terminated if required.

### API
API keys allow websites access to the system using a combination of a public and private key.  Public key access is more heavily restricted than private key access is.  The private key is normally needed to access /api urls, whilst the public key is needed for /content and /auth urls

### Content
Content pages are stored in the database and rendered by Jade before being delivered based on if a user is logged in or not.  Pages have access to the request object so they can use their own logic to decide on content to be displayed based on the logged in user and other session variables.  When used, a public API key is needed to access them to prevent cross-site scripting attacks as these pages are suitable for access via an AJAX request.

### Reports
The system has a built in abuse reporing system at /report.  In the admin section a resolution interface is provided to allow administrators to review and take action based on reports received.  New reports that have arrived outside of the main reporting system can also be added.  Reports added by a user will trigger an email, sent via SendGrid, to alert to the new report.