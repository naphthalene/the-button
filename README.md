# The Button
Console Monitoring made for The Mighty Button

It's a node.js application ready to be used as-is **with** redis (local server):

    git clone https://github.com/cabz/the-button.git
    cd the-button
    npm install
    node main.js

Redis usage is only to store clicks and lowest second recorded. If you don't want to use this feature, make sure to disable the options to save and load (from the main.js):

```javascript
var options = {
    save_data: false,
    load_data: false
};
```
    

Also, this application was conceived with the fact that you have at least a height of 63 lines showing in the console. If you want less (or more), just edit lib/Manager.js -> constants.TOTAL_ROWS:

```javascript
var constants = {
    COLS_LENGTH: 13,
    TOTAL_ROWS: 63,
    LATEST_CLICKS: 41
};
```
    

Your console should show something like this:

![Example Console Output](http://i.imgur.com/PE9poXL.png)

Enjoy.
