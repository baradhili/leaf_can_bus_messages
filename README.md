# Nissan LEAF CAN bus messages (in .DBC format!)

This is an evolution of the spreadsheet found at https://docs.google.com/spreadsheets/d/1EHa4R85BttuY4JZ-EnssH4YZddpsDVu6rUFm0P7ouwg/edit#gid=1

Proper CAN database files are also found in this repository along with the original excel spreadsheet. The .dbc files are easier to use when working with CAN messages. Please note that there are major differences between ZE0,AZEO and ZE1 LEAFs

Please fork the repo and make changes in your repo before creating a pullrequest, or message me if you have some CAN findings to share.

## How to browse the database?

Download 'Kvaser Database Editor 3' https://www.kvaser.com/download/
With this tool you can open the .DBC files and explore the frames and the position of the data inside the frame.
![alt text](https://github.com/dalathegreat/leaf_can_bus_messages/blob/master/DatabaseEditor.PNG)

DBC files are also extremely useful for reverse engineering, if you playback a CAN log these files can be used directly for translating the data.
