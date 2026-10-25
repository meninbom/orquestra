const test = require("node:test");
const assert = require("node:assert/strict");
const { validPdfPages } = require("../desktop/pdf.cjs");

test("PDF page validation accepts local SVG data and rejects active or remote content", () => {
  const safe = '<svg xmlns="http://www.w3.org/2000/svg"><style>@font-face{src:url(data:font/woff2;base64,AA==)}</style><image href="data:image/png;base64,AA=="/><use href="#shape"/></svg>';
  assert.equal(validPdfPages([safe]), true);
  for (const unsafe of [
    '<svg><script>alert(1)</script></svg>',
    '<svg><image href="https://example.test/pixel.png"/></svg>',
    '<svg><style>@import "https://example.test/style.css";</style></svg>',
    '<svg><rect onclick="alert(1)"/></svg>',
    '<svg><image href="data:image/png;base64,AA==" style="fill:url(https://example.test/a)"/></svg>',
  ]) assert.equal(validPdfPages([unsafe]), false, unsafe);
});
