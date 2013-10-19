/**
 * A screen to manage on-device data/logs and download it to
 * our database.
 */

window.Fluke289LogManagementView = Backbone.View.extend({

    initialize:function (options) {
        
        linkManager.on('input', this.showInput, this);        

    },
    
    
    render: function() {
        $(this.el).html(this.template());
        // The link manager is always connected when we initialize (main.js makes sure of that)
        // so we send a few commands to initialize the contents of the display:
        linkManager.driver.getMemInfo();

        return this;
    },
    
    onClose: function() {
        //linkManager.off('input', this.showInput, this);
        linkManager.off(null,null,this);
    
    },
    
    showInput: function(data) {
        console.log("Fluke289 Log Mgt view input processing");
        if(data.memlevel) {
            var span =$('#memlevel',this.el);
            span.html(data.memlevel);
            switch(data.memlevel) {
                    case 'OK':
                        span.addClass("label-success").removeClass("label-warning").removeClass("label-important");
                        break;
                    default:
                        span.removeClass("label-success").removeClass("label-warning").removeClass("label-important");
            }
        }
        
        if (data.savedlogs) {
            _.each(data.savedlogs, function(value,key) {
                $('#mem'+key,this.el).html(value);
                // Then query information about each of those logs
                if (key == "record") {
                    for (var i=0; i < value; i++)
                        linkManager.manualCommand('QRSI ' + i);
                }

            });   
        }
        
        if (data.recordingID) {
            // This is a trendlog recording sumary: add a summary card for it
            var card = _.template('<li><div class="thumbnail glowthumbnail thumbnail-larger select" style="text-align: center;"><h4><%=recordingName%></div></li>');
            $('#records',this.el).append(card(data));
            
        }
    
    },
    
});