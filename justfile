
# clean [DIR...]
clean +DIR:
    #!/usr/bin/env node
    var fs = require('node:fs');
    "{{DIR}}".split(" ").forEach(function(dir) {
        fs.rmSync(dir,{recursive:true,force:true});
    });

# compile typescript
compile: (clean "dist" "libs")
    tsc

# package cjs module
package: compile
    esbuild --bundle --minify --platform=node \
        --outfile=dist/index.cjs \
        src/index.ts
