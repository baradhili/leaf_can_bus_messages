/**
 * This script interprets the active polling queries and responses.
 * 
 * Currently supports "candump" and CSV canlog files. It is possible to add anytype of Can log parser you wish. See "CandumpCanLineParser" for example parser.
 * 
 * Based off the active polling document here: https://github.com/dalathegreat/leaf_can_bus_messages
 * 
 * Install node.js
 * put this script in a directory
 * put your CAN log file into this same directory, and rename it to "canlog.log"
 * run with "node active_polling_interpret.js"
 */

const fs = require('fs');
const canlogFilePath = "canlog.log" //insdie the current directory.

//entrance to script - called at the bottom after all functions and classes are initialized.
function main() {
	const canLineFactory = new CanLineFactory(); //factory class that converts parsed can lines into respective classes to be interpretted (e.g CanLine7BB, or CanLine78C etc...) and associates querie(s) and response(s) together
	const parser = new CandumpCanLineParser(); //uncomment your desired parser here. Candump is a log file generator used on linux. and has it's own unique line format.
	//const parser = new CSVCanLineParser();

	readAndInterpretLines(canlogFilePath, canLineFactory, parser)

	function readAndInterpretLines(fileName, canLineFactory, parser) {
		fs.readFile(fileName, 'utf8', (err, data) => {
		  if (err) {
		    	console.error(err);
		    	return;
		  }

		  const lines = data.split(/\r?\n/)
		  interpretLines(canLineFactory, lines, parser)
		});
	}

	function interpretLines(canLineFactory, lines, parser) {
		lines.forEach(line => {
	  	let canLineInterpretted = canLineFactory.createClass(line, parser)

	  	//go through all the ECUs and interpret them. Don't handle a message twice
	  	let didHandle = interpretHVBatteryCanLine(canLineInterpretted)
	  	if (!didHandle) {
	  		didHandle = interpretTMICanLine(canLineInterpretted)
	  	}

			canLineInterpretted.print()
	  })
	}

  let associated78CQueryCanLine;
	function interpretTMICanLine(canLineInterpretted) {
		if (canLineInterpretted.id == "784" || canLineInterpretted.id == "78C") {
  		if (canLineInterpretted.id == "784") {
  			associated78CQueryCanLine = canLineInterpretted
			} else if (canLineInterpretted.id == "78C") {
				if (associated78CQueryCanLine !== undefined) {
					canLineInterpretted.associatedQueries = [associated78CQueryCanLine]
				}
			}

			return true
		}

		return false
	}

  let associated7BBQueryCanLines = []
  let associated7BBResponseCanLines = []
	function interpretHVBatteryCanLine(canLineInterpretted) {
		if (canLineInterpretted.id == "7BB" || canLineInterpretted.id == "79B") {
  		if (canLineInterpretted.id == "79B") {
  			/*
  				Only reset the associated lines when we get a new 79B message and the last message we received was 7BB. Otherwise keep appending the messages to the associated list so that we get this repeating pattern
  				0x79B - query
  				0x79B - query
  				0x7BB - response
  				0x7BB - response
  				0x7BB - response
  				..
  				..
  				0x79B 0221XXXXXXXXXXXX <= when this appears, reset the associated can lines. - new query
  				Not the best since different 0x79B  queries with responses can be received asynchronously. This requires more work to get all queries and responses associated properly. Not sure how to do that as responses are not tagged uniquely to it's query group
  			*/
  			if (canLineInterpretted.isFirstQueryMessage()) {
  				associated7BBResponseCanLines = []
  				associated7BBQueryCanLines = []
  			}

  			associated7BBQueryCanLines.push(canLineInterpretted)
  		} else if (canLineInterpretted.id == "7BB") {
  			canLineInterpretted.associatedQueries = [...associated7BBQueryCanLines]
  			canLineInterpretted.associatedResponses = [...associated7BBResponseCanLines]

  			//push this 7BB message after. This way the next 7BB canline has reference only to it's previous, not including itself.
  			associated7BBResponseCanLines.push(canLineInterpretted)
  		}

  		return true
  	}

  	return false
	}
}


class CanLineParser {
	//returns a tuple in format - [dataArray, id, timestamp, busName]
	parseCanLine(line) {

	}
}

class CandumpCanLineParser extends CanLineParser {
	//(1674529757.923055) can0 7BB#2CB08660FFFFFFFF
	parseCanLine(line) {
		let busName;
		let dataArray = [];
		let timestamp;
		let id;

		const items = line.split(" ")

		if (items.length == 3) {
			//parse the timestamp
			let timestampLine = items[0];
			timestampLine = timestampLine.replace("(", "")
			timestampLine = timestampLine.replace(")", "")
			timestamp = Number(timestampLine);

			busName = items[1];

			let dataItem = items[2];
			const dataItems = dataItem.split("#")

			if (dataItems.length == 2) {
				id = dataItems[0]

				let numbers = dataItems[1].split("").reverse()
				
				//every two
				while (numbers.length > 1) {
					let firstDigit = numbers.pop() //pop removes values from the array
					let secondDigit = numbers.pop()

					let hexNumber = Number("0x" + firstDigit + secondDigit)
					dataArray.push(hexNumber)
				}

				return [dataArray, id, timestamp, busName]
			}
	  	} else {
	  		console.error(`Error: Couldn't parse line into CanDumpCanLogLine - ${line}`)
	  		return [dataArray, id, timestamp, busName]
	  	}
	}
}

class CSVCanLineParser extends CanLineParser {
	parseCanLine(line) {
		//TODO: implement
	}
}

class TSVCanLineParser extends CanLineParser {
	parseCanLine(line) {
		//TODO: implement
	}
}

class CanLine {
	associatedQueries = []
	associatedResponses = []

	line;
	dataArray = [];
	id;
	timestamp;
	busName;
	parser;

	constructor(line, parser) {
		this.line = line;
		this.parser = parser;

		this.parseCanLine(line, parser)
	}

	parseCanLine(line, parser) {
		this.line = line;
		this.parser = parser

		let [dataArray, id, timestamp, busName] = this.parser.parseCanLine(line)
		this.dataArray = dataArray
		this.id = id
		this.timestamp = timestamp
		this.busName = busName
	}

	interpret() {
		return "Unhandled Generic canline - Can't be interpreted"
	}

	print() {
		console.log(`${this.line} - ${this.timestamp} - ${this.busName} - ${this.id} - ${this.dataArray} - ${this.interpret()}`)
	}
}

//!TS! - handles parsing the canline with it's given parser, then associating it with a specific class for interpretation, usually based on the "id"
class CanLineFactory {
	createClass(line, parser) {
		let genericCanLine = new CanLine(line, parser)

		if (genericCanLine.id == "7BB") { //response
			return new CanLine7BB(genericCanLine.line, parser)
		} else if (genericCanLine.id == "79B") { //query 
			return new CanLine79B(genericCanLine.line, parser)
		} else if (genericCanLine.id == "78C") { //response
			return new CanLine78C(genericCanLine.line, parser)
		} else if (genericCanLine.id == "784") { //query
			return new CanLine784(genericCanLine.line, parser)
		} else {
			return genericCanLine
		}	
	}
}

//HVBat - query
class CanLine79B extends CanLine {
	isFirstQueryMessage() {
		return this.firstByte() == 2 && this.secondByte() == 33
	}

	isLastQueryMessage() {
		return this.firstByte() == 48
	}

	firstByte() {
		if (this.dataArray.length > 2) {
			return this.dataArray[0]
		}

		console.error(`Error: No firstByte`)
		return -1
	}

	secondByte() {
		if (this.dataArray.length > 2) {
			return this.dataArray[1]
		}

		console.error(`Error: No secondByte`)
		return -1
	}

	group() {
		if (this.dataArray.length > 2) {
			return this.dataArray[2]
		}

		console.error(`Error: No group`)
		return -1
	}

	interpret() {
		if (this.isFirstQueryMessage()) {
			return `New query message - Group: ${this.group()}`
		} else {
			return "next query message"
		}
	}
}

//HVBat - response
class CanLine7BB extends CanLine {
	type() {
		if (this.dataArray.length > 0) {
			return this.dataArray[0]
		}
		
		console.error(`Error: No type`)
		return -1
	}

	queryGroup() {
		if (this.associatedQueries.length > 0) {
			return this.associatedQueries[0].group()
		}

		console.error(`Error: No group`)
		return -1
	}

	interpret() {
		let interpretString = `Queries: ${this.associatedQueries.length} - Responses: ${this.associatedResponses.length} - Group: ${this.queryGroup()} - Type: ${this.type()}`
		let type = this.type()
		let queryGroup = this.queryGroup()

		interpretString += "\n"

		if (queryGroup == 1) {
			if (type == 16) { //10 in hex
				//HV_Battery_Current_1
				interpretString += `HV_Battery_Current_1 = ${this.parseHVBatteryCurrent1Amps()} A` 
			} else if (type == 33) { //21 in hex
				//HV_Battery_Current_2
				interpretString += `HV_Battery_Current_2 = ${this.parseHVBatteryCurrent2Amps()} A` 
			} else if (type == 34) { //22 in hex

			} else if (type == 35) { //23 in hex
				//insulation
				interpretString += `HV_Insulation = ${this.parseInsultation()} unknown integer` 
				//battery voltage
				interpretString += `\nHV_Battery_Voltage = ${this.parseBatteryVoltage()} V` 

			} else if (type == 36) { //24 in hex
				//healthPercentage
				interpretString += `HV_Health_Percentage = ${this.parseHealthPercentage()} %` 
			} else if (type == 37) { //25 in hex
				//amp hours
				interpretString += `HV_Amps_Hours = ${this.parseAmpHours()} Ah` 

				//SOC
				interpretString += `\nHV_SOC = ${this.parseSOC()} %` 

				//GIDs
				interpretString += `\nHV_GIDs = ${this.parseGIDs()} GIDs` 
			} else if (type == 38) { //26 in hex

			} else if (type == 39) { //27 in hex

			}
		} else if (queryGroup == 2) {
			interpretString += "TODO: implement - cell millivoltage"
		} else if (queryGroup == 4) {
			interpretString += "TODO: implement - pack temperature"
		} else if (queryGroup == 6) {
			interpretString += "TODO: implement - shunts"
		} else if (queryGroup == 97) { //group 61
			interpretString += "TODO: implement - SOH %"
		} else if (queryGroup == 132) { //group 84
			interpretString += "TODO: implement - battery serial"
		}

		return interpretString
	}

	parseSOC() {
		if (this.associatedResponses.length > 0) {
			let data24 = this.associatedResponses[this.associatedResponses.length-1]
			let data24_7 = data24[7]
			let data25_1 = this.dataArray[1]
			let data25_2 = this.dataArray[2]

			return ((data24_7 << 16) | ((data25_1 << 8) | data25_2)) / 10000
		}

		return 0
	}

	parseGIDs() {
		return ((4.425*(this.parseSOC() * 0.01)) * this.parseAmpHours())
	}

	parseBatteryVoltage() {
		let data1 = this.dataArray[1]
		let data2 = this.dataArray[2]

		return ((data1 << 8) | data2) / 100
	}

	parseAmpHours() {
		let data4 = this.dataArray[4]
		let data5 = this.dataArray[5]
		let data6 = this.dataArray[6]

		return (((data4 << 16) | ((data5 << 8) | data6))) / 10000
	}

	parseHealthPercentage() {
		let data4 = this.dataArray[4]
		let data5 = this.dataArray[5]

		return (((data4 << 8) | data5) / 102.4) * 100
	}

	parseInsultation() {
		let data5 = this.dataArray[5]
		let data6 = this.dataArray[6]

		return ((data5 << 8) | data6)
	}

	parseHVBatteryCurrent1Amps() {
		let data4 = this.dataArray[4]
		let data5 = this.dataArray[5]
		let data6 = this.dataArray[6]
		let data7 = this.dataArray[7]

		var amps = (data4 << 24) | (data5 << 16) | ((data6 << 8 | data7))

		if ((amps & 0x8000000) == 0x8000000) {
			amps = (amps | -0x100000000) / 1024.0
		} else {
			amps = amps / 1024.0
		}

		return amps;
	}

	parseHVBatteryCurrent2Amps() {
		let data4 = this.dataArray[3]
		let data5 = this.dataArray[4]
		let data6 = this.dataArray[5]
		let data7 = this.dataArray[6]

		var amps = (data4 << 24) | (data5 << 16) | ((data6 << 8 | data7))

		if ((amps & 0x8000000) == 0x8000000) {
			amps = (amps | -0x100000000) / 1024.0
		} else {
			amps = amps / 1024.0
		}

		return amps;
	}
}

//TMI - query
class CanLine784 extends CanLine {
	isMotorTemperatureQuery() {
		return this.dataArray.length >= 4 && this.dataArray[0] == 3 && this.dataArray[1] == 34 && this.dataArray[2] == 17 && this.dataArray[3] == 33
	}

	isMotorTorqueQuery() {
		return this.dataArray.length >= 4 && this.dataArray[0] == 3 && this.dataArray[1] == 34 && this.dataArray[2] == 18 && this.dataArray[3] == 37
	}

	interpret() {
		if (this.isMotorTemperatureQuery()) {
			return ` - is motor temp query`

		} else if (this.isMotorTorqueQuery()) {
			return ` - is motor torque query`
		}
	}
}

//TMI - response
class CanLine78C extends CanLine {
	interpret() {
		if (this.associatedQueries.length == 1) {
			if (this.associatedQueries[0].isMotorTemperatureQuery()) {
				return `\nTMI_Motor_Temp ${this.parseTemperature()} C`

			} else if (this.associatedQueries[0].isMotorTorqueQuery()) {
				return `\nTMI_Motor_Torque ${this.parseTorque()} Nm`
			}
		}
	}

	parseTorque() {
		let data4 = this.dataArray[4]
		let data5 = this.dataArray[5]

		let torque = (data4 << 8) | data5
		if (torque & 32768 == 327680) {
			torque = torque | -65536
		}

		return torque / -64.0;
	}

	parseTemperature() {
		let data4 = this.dataArray[4]

		return (data4 - 40)
	}
}

main()
