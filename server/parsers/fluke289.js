/*
 * Parser (ASCII format) for the Fluke 289 multimeter
 *
 *
 *
 */

module.exports = {
    parser: null,
    
    /* Friendly name for the type of device */
    name: "Fluke 289",
    
    /* Measurement units that can come from this type of device
     *
     * To be used during device config to enable what we're interested in?
     */
    units: [ "Volt", "Ampere", "Farad", "Ohm", "Hertz", "Percent" ],

    // How the device is connected on the serial port            
    portSettings: {
            baudRate: 115200,
            dataBits: 8,
            parity: 'none',
            stopBits: 1,
            flowControl: false,
            parser: this.parser,
    },    

}