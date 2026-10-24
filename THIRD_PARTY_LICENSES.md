# Third-Party Licenses

Renderloom relies on open-source dependencies and assets. This document provides notice and licensing details for runtime dependencies and bundled font assets.

---

## Bundled Fonts

### Roboto Regular
- **Source:** [Google Fonts / Roboto](https://github.com/googlefonts/roboto)
- **Path:** `src/renderer/fonts/Roboto-Regular.ttf`
- **License:** SIL Open Font License, Version 1.1 (OFL 1.1)
- **Copyright:** Copyright 2011 Google Inc. All Rights Reserved.
- **License Text:** See [`src/renderer/fonts/LICENSE.txt`](src/renderer/fonts/LICENSE.txt)

---

## Runtime Production Dependencies

| Package | Version | License | Upstream Project |
|---------|---------|---------|------------------|
| `@resvg/resvg-js` | 2.6.2 | Apache-2.0 | [https://github.com/thx/resvg-js](https://github.com/thx/resvg-js) |
| `satori` | 0.63.2 | MIT | [https://github.com/vercel/satori](https://github.com/vercel/satori) |
| `react` | ^19.0.0 | MIT | [https://github.com/facebook/react](https://github.com/facebook/react) |
| `react-dom` | ^19.0.0 | MIT | [https://github.com/facebook/react](https://github.com/facebook/react) |
| `zod` | ^3.24.2 | MIT | [https://github.com/colinhacks/zod](https://github.com/colinhacks/zod) |

---

## License Texts

### Apache License 2.0 (`@resvg/resvg-js`)
Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at:
http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

### MIT License (`satori`, `react`, `react-dom`, `zod`)
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### SIL Open Font License 1.1 (`Roboto`)
This Font Software is licensed under the SIL Open Font License, Version 1.1.
The license is available with a FAQ at: http://scripts.sil.org/OFL
See `src/renderer/fonts/LICENSE.txt` for complete terms and conditions.
