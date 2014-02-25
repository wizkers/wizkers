/**
 *  Elecraft Live Display view
 */

window.ElecraftLiveView = Backbone.View.extend({

    initialize:function () {
        this.deviceinitdone = false;

        //this.render();
        //_.bindAll(this,"handleKX3Button");
        
        linkManager.on('status', this.updateStatus, this);
        linkManager.on('input', this.showInput, this);

    },

    render:function () {
        var self = this;
        $(this.el).html(this.template());
        var s = Snap("#kx3");
        Snap.load("img/KX3.svg", function (f) {
                f.select("#layer1").click(function (e) {
                    self.handleKX3Button(e);
                });
            // Initialize icon display:
            f.select(".icon").attr({ visibility: 'hidden' });
                s.add(f);
                // Set display constraints for the radio face:
                s.attr({
                    width: "100%",
                    height: 350
                });
        });
        
        $("#rf-control", this.el).slider();
        $("#ag-control", this.el).slider();
        $("#bpf-control", this.el).slider();
        $("#ct-control", this.el).slider();
        return this;
    },
    
    onClose: function() {
        linkManager.off('status', this.updatestatus, this);
        linkManager.off('input', this.showInput, this);
        console.log("Elecraft live view closing...");        
    },
    
    events: {
        "click #power-direct-btn": "setpower",
        "click input#power-direct": "setpower",
        "keypress input#power-direct": "setpower",
        "keypress input#vfoa-direct": "setvfoa",
        "keypress input#vfob-direct": "setvfob",
        "click #vfoa-direct-btn": "setvfoa",
        "click #vfob-direct-btn": "setvfob",
        "slideStop #ag-control": "setAG",
        "slideStop #rf-control": "setRG",
        "slideStop #bpf-control": "setBW",
    },
    
    setpower: function(e) {
        if ((event.target.id == "power-direct" && event.keyCode==13) || (event.target.id != "power-direct") || 
             (event.type == "click")) {
            linkManager.driver.setPower($("#power-direct").val());
        }
    },
    
    setvfoa: function() {
        if ((event.target.id == "vfoa-direct" && event.keyCode==13) || (event.target.id != "vfoa-direct")) {
            linkManager.driver.setVFO($("#vfoa-direct",this.el).val(),"a");
        }
    },

    setvfob: function() {
        if ((event.target.id == "vfob-direct" && event.keyCode==13) || (event.target.id != "vfob-direct")) {
            linkManager.driver.setVFO($("#vfob-direct",this.el).val(),"b");
        }
    },
    
    setAG: function(e) {
        linkManager.driver.setAG(e.value);
    },
    
    setRG: function(e) {
        // Note: on the slider we do -60 to 0, the driver converts into KX3 internal values
        linkManager.driver.setRG(e.value);
    },
    
    setBW: function(e) {
        linkManager.driver.setBW(e.value);
    },
    
    buttonCodes: {
        "B_BAND_PLUS": "T08", "B_RCL": "H08",
        "B_BAND_MINUS": "T41", "B_STORE": "H41",
        "B_FREQ_ENT": "T10", "B_SCAN": "H10",
        "B_MSG": "T11", "B_REC": "H11",
        "B_ATU_TUNE": "T44", "B_ANT": "H44",
        "B_XMIT": "T16", "B_TUNE": "H16",
        "B_PRE": "T19", "B_NR": "H19",
        "B_ATTN": "T27", "B_NB": "H27",
        "B_APT": "T20", "B_NTCH": "H20",
        "B_SPOT": "T28", "B_CWT": "H28",
        "B_CMP": "T21", "B_PITCH": "H21",
        "B_DLY": "T29", "B_VOX": "H29",
        "B_MODE": "T14", "B_ALT": "H14",
        "B_DATA": "T17", "B_TEXT": "H17",
        "B_RIT": "T18", "B_PF1": "H18",
        "B_RATE": "T12", "B_KHZ": "H12",
        "B_A_SLASH_B": "T24", "B_REV": "H24",
        "B_A_TO_B": "T25", "B_SPLIT": "H25",
        "B_XIT": "T26", "B_PF2": "H26",
        "B_DISP": "T09", "B_MENU": "H09"
    },

    handleKX3Button: function(e) {
        console.log(e.target.id);
        $("#kx3 #filter-II").css("visibility", "visible");
        var code = this.buttonCodes[e.target.id];
        if (code != null) {
            linkManager.manualCommand('SW' + code + ';');
        }        
    },
    
    updateStatus: function(data) {
        if (linkManager.connected && !this.deviceinitdone) {
            linkManager.startLiveStream();
            
            // Ask the radio for a few additional things:
            // Requested power:
            linkManager.driver.getRequestedPower();
        } else {
            this.deviceinitdone = false;
        }        
    },
    
    setIcon: function(name, visible) {
        $("#kx3 #" + name).css("visibility", (visible) ? "visible" : "hidden");
    },


    showInput: function(data) {
        // Now update our display depending on the data we received:
        var cmd = data.substr(0,2);
        var val = data.substr(2);
        if (cmd == "DB") {
            // VFO B Text
            $("#kx3 #VFOB").html(val + "&nbsp;&nbsp;");
        } else if (cmd == "DS") {
            // VFO A Text, a bit more tricky:
            if (val.length < 8) {
                console.log("Error: VFO A buffer too short!");
                return;
            }
            var txt = "";
            for (var i=0; i < 8; i++) {
                if (val.charCodeAt(i) & 0x80) // Dot on the left side of the character
                    txt += ".";
                var val2 = val.charCodeAt(i) & 0x7F;
                // Do replacements:
                if (val2 == 0x40)
                        val2 = 0x20;
                txt += String.fromCharCode(val2);
            }
            $("#kx3 #VFOA").html(txt);
            // Now, decode icon data:
            var a = val.charCodeAt(8);
            var f = val.charCodeAt(9);
            
            
        } else if (cmd == "PC") {
            $("#power-direct").val(parseInt(val));
        } else if (cmd == "FA") {
            $("#vfoa-direct").val(parseInt(val)/1e6);
        } else if (cmd == "FB") {
            $("#vfob-direct").val(parseInt(val)/1e6);
        } else if (cmd =="AG") {
            $("#ag-control", this.el).slider('setValue',val);
        } else if (cmd =="RG") {
            $("#rf-control", this.el).slider('setValue',val-250);
        } else if (cmd =="BW") {
            $("#bpf-control", this.el).slider('setValue',val/100);
        }

    },

});
