/**
 * Where we are storing our database configuration and schemas.
 *
 * (c) 2013 Edouard Lafargue, edouard@lafargue.name
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


var mongoose = require( 'mongoose' );
var Schema   = mongoose.Schema;


/**
 * Our data schema for the application is defined here
 */

/**
 * TO DO or possibilities:
 * - Loco response curves (bemf/power) over time.
 *     -> In a separate document?
 * - Controller settings for the loco ?
 * - PDF documentation (one PDF document)
 * - Portfolio for the loco: several pictures & PDFs
 *
 */
var InstrumentSchema = new Schema({
    
        name: String,           // Used for display
        type: String,           // Will correspond to parsers known on the server side
        tag: String,            // Asset tag for the instrument (if supported)
        uuid: String,           // Serial number or unique ID (if supported)
        port: String,           // Name of the port on server side
        comment: String,        // Simple comments
        icon: String,           // TbD: either user-selectable, or served by server-side (linked to type)
        liveviewspan: String,                 // Width of live view in seconds
        liveviewperiod: String,                 // Period of polling if supported
        liveviewlogscale: Boolean,                // Should live view display as a log scale by default ?

});
 
// Compile the schema by issuing the below:
mongoose.model('Instrument', InstrumentSchema );


/**
 * Settings: global application settings.
 *
 * For now: ID of the current layout, and current loco
 */
var ApplicationSettingsSchema = new Schema({
    currentLayout: {type: Schema.Types.ObjectId, ref:'Layout', default:null},
    currentLoco: {type: Schema.Types.ObjectId, ref:'Loco', default:null},
    powersliderstyle: String,
    itemsperpage: Number,
});

mongoose.model('Settings',ApplicationSettingsSchema);



/**
 *  Device logs
 *  Device logs manage generic log entries (using 'data' which can be anything)
 */
var DeviceLogEntrySchema = new Schema({
    logsessionid: {type: Schema.Types.ObjectId, ref:'LogSession', default:null}, // Should match the ID of a log session model (see below)
    timestamp: Date,    // Javascript timestamp for that entry (milliseconds since 1970)
    comment: String,     // We will one day support commenting any data point in a log...
    data: Schema.Types.Mixed       // Will be an object that depends on the device type
});
mongoose.model('DeviceLogEntry', DeviceLogEntrySchema);

var LogSession = new Schema({
       instrumentid: {type: Schema.Types.ObjectId, ref:'Instrument', default:null},
                            // Device model
       logtype: String,     // To be used by the device driver, in case the device supports different
                            // kinds of logs.
       guid: String,        // Device UUID for this log session
       swversion: String,   // Keep track of firmware version for the log session (traceability)
       name: String,        // Let user name logging session if necessary
       description: String, // Likewise, let user describe the session there too.
       startstamp: Date,
       endstamp : Date,
       datapoints: Number,
});
mongoose.model('LogSession', LogSession);


var uri = 'mongodb://localhost/vizappdb';
var connectDB = function() {
    mongoose.connect(uri, function (err) {
        // if we failed to connect, retry
        if (err) {
            console.log("Database not ready");
            setTimeout(connectDB, 500);
        } else {
            ready = true;
        }
    })
};



connectDB();
