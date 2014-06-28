/**
 *  Settings returns an intrument settings view. These are displayed
 * on top of standard instrument settings in the instrument details view.
 *  
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */


/** Model is an Instrument **/
window.SampleInstrumentSettingsView = Backbone.View.extend({
    
    initialize:function () {
        // Metadata is a simple object looking like this:
        // {  'address': 'name', 'address2': 'name2', etc... }
        this.mappings = this.model.get('metadata');
        if (this.mappings == null) {
            this.mappings = {};
            this.model.set('metadata', this.mappings);
        }
        this.render();
    },

    render:function () {
        $(this.el).html(this.template({mappings: this.mappings}));
        return this;
    },
    
    events: {
        "change" : "change"
    },
    
    change: function(event) {
        console.log("Sample Instrument bespoke settings change");

        // Apply the change to the metadata
        var target = event.target;        
        this.mappings[target.name] = target.value;
        this.model.set('metadata',this.mappings);
        
        // This view is embedded into another view, so change events
        // are going to bubble up to the upper view and change attributes
        // with the same name, so we stop event propagation here:
        event.stopPropagation();
    },


});