        /*
            ---------- Hexdump utility for debugging ------------
        */
        function to_hex( number ) {
            var r = number.toString(16);
            if( r.length < 2 ) {
                return "0" + r;
            } else {
                return r;
            }
        };

        function dump_chunk( chunk ) {
            var dumped = "";
            for( var i = 0; i < 4; i++ ) {
                if( i < chunk.length ) {
                    dumped += to_hex( chunk.charCodeAt( i ) );
                } else {
                    dumped += "..";
                }
            }
            return dumped;
        };
	
        function dump_block( block ) {
            var dumped = "";
            var chunks = block.match( /[\s\S.]{1,4}/g );
            for( var i = 0; i < 4; i++ ) {
                if( i < chunks.length ) {
                    dumped += dump_chunk( chunks[i] );
                } else {
                    dumped += "........";
                }
                dumped += " ";
            }

            dumped += "    " + block.replace( /[\x00-\x1F]/g, "." );

            return dumped;
        };
	
        function dump( s ) {
            var dumped = "";

            var blocks = s.match( /[\s\S.]{1,16}/g );
            for( var block in blocks ) {
                dumped += dump_block( blocks[block] ) + "\n";
            }

            return dumped;
        };
        
        /*************************** End of utils ******************/
        
