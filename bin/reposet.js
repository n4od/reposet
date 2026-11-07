#!/usr/bin/env node
'use strict';

require('../src/cli')
  .main(process.argv.slice(2))
  .catch((error) => {
    console.error(error && error.message ? `error: ${error.message}` : error);
    process.exit(1);
  });
