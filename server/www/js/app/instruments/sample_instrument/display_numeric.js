/*
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */
// Model is the instrument
window.SampleInstrumentNumView = Backbone.View.extend({

    initialize:function () {
        this.render();
    },

    render:function () {
        $(this.el).html(this.template());
        return this;
    },
    
    onClose: function() {
        console.log("Instrument numeric view closing...");        
    },


});