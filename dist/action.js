"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/semver/internal/constants.js
var require_constants = __commonJS({
  "node_modules/semver/internal/constants.js"(exports2, module2) {
    "use strict";
    var SEMVER_SPEC_VERSION = "2.0.0";
    var MAX_LENGTH = 256;
    var MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || /* istanbul ignore next */
    9007199254740991;
    var MAX_SAFE_COMPONENT_LENGTH = 16;
    var MAX_SAFE_BUILD_LENGTH = MAX_LENGTH - 6;
    var RELEASE_TYPES = [
      "major",
      "premajor",
      "minor",
      "preminor",
      "patch",
      "prepatch",
      "prerelease"
    ];
    module2.exports = {
      MAX_LENGTH,
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_SAFE_INTEGER,
      RELEASE_TYPES,
      SEMVER_SPEC_VERSION,
      FLAG_INCLUDE_PRERELEASE: 1,
      FLAG_LOOSE: 2
    };
  }
});

// node_modules/semver/internal/debug.js
var require_debug = __commonJS({
  "node_modules/semver/internal/debug.js"(exports2, module2) {
    "use strict";
    var debug = typeof process === "object" && process.env && process.env.NODE_DEBUG && /\bsemver\b/i.test(process.env.NODE_DEBUG) ? (...args) => console.error("SEMVER", ...args) : () => {
    };
    module2.exports = debug;
  }
});

// node_modules/semver/internal/re.js
var require_re = __commonJS({
  "node_modules/semver/internal/re.js"(exports2, module2) {
    "use strict";
    var {
      MAX_SAFE_COMPONENT_LENGTH,
      MAX_SAFE_BUILD_LENGTH,
      MAX_LENGTH
    } = require_constants();
    var debug = require_debug();
    exports2 = module2.exports = {};
    var re = exports2.re = [];
    var safeRe = exports2.safeRe = [];
    var src = exports2.src = [];
    var safeSrc = exports2.safeSrc = [];
    var t = exports2.t = {};
    var R = 0;
    var LETTERDASHNUMBER = "[a-zA-Z0-9-]";
    var safeRegexReplacements = [
      ["\\s", 1],
      ["\\d", MAX_LENGTH],
      [LETTERDASHNUMBER, MAX_SAFE_BUILD_LENGTH]
    ];
    var makeSafeRegex = (value) => {
      for (const [token, max] of safeRegexReplacements) {
        value = value.split(`${token}*`).join(`${token}{0,${max}}`).split(`${token}+`).join(`${token}{1,${max}}`);
      }
      return value;
    };
    var createToken = (name, value, isGlobal) => {
      const safe = makeSafeRegex(value);
      const index = R++;
      debug(name, index, value);
      t[name] = index;
      src[index] = value;
      safeSrc[index] = safe;
      re[index] = new RegExp(value, isGlobal ? "g" : void 0);
      safeRe[index] = new RegExp(safe, isGlobal ? "g" : void 0);
    };
    createToken("NUMERICIDENTIFIER", "0|[1-9]\\d*");
    createToken("NUMERICIDENTIFIERLOOSE", "\\d+");
    createToken("NONNUMERICIDENTIFIER", `\\d*[a-zA-Z-]${LETTERDASHNUMBER}*`);
    createToken("MAINVERSION", `(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})\\.(${src[t.NUMERICIDENTIFIER]})`);
    createToken("MAINVERSIONLOOSE", `(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})\\.(${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASEIDENTIFIER", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIER]})`);
    createToken("PRERELEASEIDENTIFIERLOOSE", `(?:${src[t.NONNUMERICIDENTIFIER]}|${src[t.NUMERICIDENTIFIERLOOSE]})`);
    createToken("PRERELEASE", `(?:-(${src[t.PRERELEASEIDENTIFIER]}(?:\\.${src[t.PRERELEASEIDENTIFIER]})*))`);
    createToken("PRERELEASELOOSE", `(?:-?(${src[t.PRERELEASEIDENTIFIERLOOSE]}(?:\\.${src[t.PRERELEASEIDENTIFIERLOOSE]})*))`);
    createToken("BUILDIDENTIFIER", `${LETTERDASHNUMBER}+`);
    createToken("BUILD", `(?:\\+(${src[t.BUILDIDENTIFIER]}(?:\\.${src[t.BUILDIDENTIFIER]})*))`);
    createToken("FULLPLAIN", `v?${src[t.MAINVERSION]}${src[t.PRERELEASE]}?${src[t.BUILD]}?`);
    createToken("FULL", `^${src[t.FULLPLAIN]}$`);
    createToken("LOOSEPLAIN", `[v=\\s]*${src[t.MAINVERSIONLOOSE]}${src[t.PRERELEASELOOSE]}?${src[t.BUILD]}?`);
    createToken("LOOSE", `^${src[t.LOOSEPLAIN]}$`);
    createToken("GTLT", "((?:<|>)?=?)");
    createToken("XRANGEIDENTIFIERLOOSE", `${src[t.NUMERICIDENTIFIERLOOSE]}|x|X|\\*`);
    createToken("XRANGEIDENTIFIER", `${src[t.NUMERICIDENTIFIER]}|x|X|\\*`);
    createToken("XRANGEPLAIN", `[v=\\s]*(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:\\.(${src[t.XRANGEIDENTIFIER]})(?:${src[t.PRERELEASE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGEPLAINLOOSE", `[v=\\s]*(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:\\.(${src[t.XRANGEIDENTIFIERLOOSE]})(?:${src[t.PRERELEASELOOSE]})?${src[t.BUILD]}?)?)?`);
    createToken("XRANGE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAIN]}$`);
    createToken("XRANGELOOSE", `^${src[t.GTLT]}\\s*${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COERCEPLAIN", `${"(^|[^\\d])(\\d{1,"}${MAX_SAFE_COMPONENT_LENGTH}})(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?(?:\\.(\\d{1,${MAX_SAFE_COMPONENT_LENGTH}}))?`);
    createToken("COERCE", `${src[t.COERCEPLAIN]}(?:$|[^\\d])`);
    createToken("COERCEFULL", src[t.COERCEPLAIN] + `(?:${src[t.PRERELEASE]})?(?:${src[t.BUILD]})?(?:$|[^\\d])`);
    createToken("COERCERTL", src[t.COERCE], true);
    createToken("COERCERTLFULL", src[t.COERCEFULL], true);
    createToken("LONETILDE", "(?:~>?)");
    createToken("TILDETRIM", `(\\s*)${src[t.LONETILDE]}\\s+`, true);
    exports2.tildeTrimReplace = "$1~";
    createToken("TILDE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAIN]}$`);
    createToken("TILDELOOSE", `^${src[t.LONETILDE]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("LONECARET", "(?:\\^)");
    createToken("CARETTRIM", `(\\s*)${src[t.LONECARET]}\\s+`, true);
    exports2.caretTrimReplace = "$1^";
    createToken("CARET", `^${src[t.LONECARET]}${src[t.XRANGEPLAIN]}$`);
    createToken("CARETLOOSE", `^${src[t.LONECARET]}${src[t.XRANGEPLAINLOOSE]}$`);
    createToken("COMPARATORLOOSE", `^${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]})$|^$`);
    createToken("COMPARATOR", `^${src[t.GTLT]}\\s*(${src[t.FULLPLAIN]})$|^$`);
    createToken("COMPARATORTRIM", `(\\s*)${src[t.GTLT]}\\s*(${src[t.LOOSEPLAIN]}|${src[t.XRANGEPLAIN]})`, true);
    exports2.comparatorTrimReplace = "$1$2$3";
    createToken("HYPHENRANGE", `^\\s*(${src[t.XRANGEPLAIN]})\\s+-\\s+(${src[t.XRANGEPLAIN]})\\s*$`);
    createToken("HYPHENRANGELOOSE", `^\\s*(${src[t.XRANGEPLAINLOOSE]})\\s+-\\s+(${src[t.XRANGEPLAINLOOSE]})\\s*$`);
    createToken("STAR", "(<|>)?=?\\s*\\*");
    createToken("GTE0", "^\\s*>=\\s*0\\.0\\.0\\s*$");
    createToken("GTE0PRE", "^\\s*>=\\s*0\\.0\\.0-0\\s*$");
  }
});

// node_modules/semver/internal/parse-options.js
var require_parse_options = __commonJS({
  "node_modules/semver/internal/parse-options.js"(exports2, module2) {
    "use strict";
    var looseOption = Object.freeze({ loose: true });
    var emptyOpts = Object.freeze({});
    var parseOptions = (options) => {
      if (!options) {
        return emptyOpts;
      }
      if (typeof options !== "object") {
        return looseOption;
      }
      return options;
    };
    module2.exports = parseOptions;
  }
});

// node_modules/semver/internal/identifiers.js
var require_identifiers = __commonJS({
  "node_modules/semver/internal/identifiers.js"(exports2, module2) {
    "use strict";
    var numeric = /^[0-9]+$/;
    var compareIdentifiers = (a, b) => {
      if (typeof a === "number" && typeof b === "number") {
        return a === b ? 0 : a < b ? -1 : 1;
      }
      const anum = numeric.test(a);
      const bnum = numeric.test(b);
      if (anum && bnum) {
        a = +a;
        b = +b;
      }
      return a === b ? 0 : anum && !bnum ? -1 : bnum && !anum ? 1 : a < b ? -1 : 1;
    };
    var rcompareIdentifiers = (a, b) => compareIdentifiers(b, a);
    module2.exports = {
      compareIdentifiers,
      rcompareIdentifiers
    };
  }
});

// node_modules/semver/classes/semver.js
var require_semver = __commonJS({
  "node_modules/semver/classes/semver.js"(exports2, module2) {
    "use strict";
    var debug = require_debug();
    var { MAX_LENGTH, MAX_SAFE_INTEGER } = require_constants();
    var { safeRe: re, t } = require_re();
    var parseOptions = require_parse_options();
    var { compareIdentifiers } = require_identifiers();
    var isPrereleaseIdentifier = (prerelease, identifier) => {
      const identifiers = identifier.split(".");
      if (identifiers.length > prerelease.length) {
        return false;
      }
      for (let i = 0; i < identifiers.length; i++) {
        if (compareIdentifiers(prerelease[i], identifiers[i]) !== 0) {
          return false;
        }
      }
      return true;
    };
    var SemVer = class _SemVer {
      constructor(version, options) {
        options = parseOptions(options);
        if (version instanceof _SemVer) {
          if (version.loose === !!options.loose && version.includePrerelease === !!options.includePrerelease) {
            return version;
          } else {
            version = version.version;
          }
        } else if (typeof version !== "string") {
          throw new TypeError(`Invalid version. Must be a string. Got type "${typeof version}".`);
        }
        if (version.length > MAX_LENGTH) {
          throw new TypeError(
            `version is longer than ${MAX_LENGTH} characters`
          );
        }
        debug("SemVer", version, options);
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        const m = version.trim().match(options.loose ? re[t.LOOSE] : re[t.FULL]);
        if (!m) {
          throw new TypeError(`Invalid Version: ${version}`);
        }
        this.raw = version;
        this.major = +m[1];
        this.minor = +m[2];
        this.patch = +m[3];
        if (this.major > MAX_SAFE_INTEGER || this.major < 0) {
          throw new TypeError("Invalid major version");
        }
        if (this.minor > MAX_SAFE_INTEGER || this.minor < 0) {
          throw new TypeError("Invalid minor version");
        }
        if (this.patch > MAX_SAFE_INTEGER || this.patch < 0) {
          throw new TypeError("Invalid patch version");
        }
        if (!m[4]) {
          this.prerelease = [];
        } else {
          this.prerelease = m[4].split(".").map((id) => {
            if (/^[0-9]+$/.test(id)) {
              const num = +id;
              if (num >= 0 && num < MAX_SAFE_INTEGER) {
                return num;
              }
            }
            return id;
          });
        }
        this.build = m[5] ? m[5].split(".") : [];
        this.format();
      }
      format() {
        this.version = `${this.major}.${this.minor}.${this.patch}`;
        if (this.prerelease.length) {
          this.version += `-${this.prerelease.join(".")}`;
        }
        return this.version;
      }
      toString() {
        return this.version;
      }
      compare(other) {
        debug("SemVer.compare", this.version, this.options, other);
        if (!(other instanceof _SemVer)) {
          if (typeof other === "string" && other === this.version) {
            return 0;
          }
          other = new _SemVer(other, this.options);
        }
        if (other.version === this.version) {
          return 0;
        }
        return this.compareMain(other) || this.comparePre(other);
      }
      compareMain(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.major < other.major) {
          return -1;
        }
        if (this.major > other.major) {
          return 1;
        }
        if (this.minor < other.minor) {
          return -1;
        }
        if (this.minor > other.minor) {
          return 1;
        }
        if (this.patch < other.patch) {
          return -1;
        }
        if (this.patch > other.patch) {
          return 1;
        }
        return 0;
      }
      comparePre(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        if (this.prerelease.length && !other.prerelease.length) {
          return -1;
        } else if (!this.prerelease.length && other.prerelease.length) {
          return 1;
        } else if (!this.prerelease.length && !other.prerelease.length) {
          return 0;
        }
        let i = 0;
        do {
          const a = this.prerelease[i];
          const b = other.prerelease[i];
          debug("prerelease compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      compareBuild(other) {
        if (!(other instanceof _SemVer)) {
          other = new _SemVer(other, this.options);
        }
        let i = 0;
        do {
          const a = this.build[i];
          const b = other.build[i];
          debug("build compare", i, a, b);
          if (a === void 0 && b === void 0) {
            return 0;
          } else if (b === void 0) {
            return 1;
          } else if (a === void 0) {
            return -1;
          } else if (a === b) {
            continue;
          } else {
            return compareIdentifiers(a, b);
          }
        } while (++i);
      }
      // preminor will bump the version up to the next minor release, and immediately
      // down to pre-release. premajor and prepatch work the same way.
      inc(release, identifier, identifierBase) {
        if (release.startsWith("pre")) {
          if (!identifier && identifierBase === false) {
            throw new Error("invalid increment argument: identifier is empty");
          }
          if (identifier) {
            const match = `-${identifier}`.match(this.options.loose ? re[t.PRERELEASELOOSE] : re[t.PRERELEASE]);
            if (!match || match[1] !== identifier) {
              throw new Error(`invalid identifier: ${identifier}`);
            }
          }
        }
        switch (release) {
          case "premajor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor = 0;
            this.major++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "preminor":
            this.prerelease.length = 0;
            this.patch = 0;
            this.minor++;
            this.inc("pre", identifier, identifierBase);
            break;
          case "prepatch":
            this.prerelease.length = 0;
            this.inc("patch", identifier, identifierBase);
            this.inc("pre", identifier, identifierBase);
            break;
          // If the input is a non-prerelease version, this acts the same as
          // prepatch.
          case "prerelease":
            if (this.prerelease.length === 0) {
              this.inc("patch", identifier, identifierBase);
            }
            this.inc("pre", identifier, identifierBase);
            break;
          case "release":
            if (this.prerelease.length === 0) {
              throw new Error(`version ${this.raw} is not a prerelease`);
            }
            this.prerelease.length = 0;
            break;
          case "major":
            if (this.minor !== 0 || this.patch !== 0 || this.prerelease.length === 0) {
              this.major++;
            }
            this.minor = 0;
            this.patch = 0;
            this.prerelease = [];
            break;
          case "minor":
            if (this.patch !== 0 || this.prerelease.length === 0) {
              this.minor++;
            }
            this.patch = 0;
            this.prerelease = [];
            break;
          case "patch":
            if (this.prerelease.length === 0) {
              this.patch++;
            }
            this.prerelease = [];
            break;
          // This probably shouldn't be used publicly.
          // 1.0.0 'pre' would become 1.0.0-0 which is the wrong direction.
          case "pre": {
            const base = Number(identifierBase) ? 1 : 0;
            if (this.prerelease.length === 0) {
              this.prerelease = [base];
            } else {
              let i = this.prerelease.length;
              while (--i >= 0) {
                if (typeof this.prerelease[i] === "number") {
                  this.prerelease[i]++;
                  i = -2;
                }
              }
              if (i === -1) {
                if (identifier === this.prerelease.join(".") && identifierBase === false) {
                  throw new Error("invalid increment argument: identifier already exists");
                }
                this.prerelease.push(base);
              }
            }
            if (identifier) {
              let prerelease = [identifier, base];
              if (identifierBase === false) {
                prerelease = [identifier];
              }
              if (isPrereleaseIdentifier(this.prerelease, identifier)) {
                const prereleaseBase = this.prerelease[identifier.split(".").length];
                if (isNaN(prereleaseBase)) {
                  this.prerelease = prerelease;
                }
              } else {
                this.prerelease = prerelease;
              }
            }
            break;
          }
          default:
            throw new Error(`invalid increment argument: ${release}`);
        }
        this.raw = this.format();
        if (this.build.length) {
          this.raw += `+${this.build.join(".")}`;
        }
        return this;
      }
    };
    module2.exports = SemVer;
  }
});

// node_modules/semver/functions/parse.js
var require_parse = __commonJS({
  "node_modules/semver/functions/parse.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse = (version, options, throwErrors = false) => {
      if (version instanceof SemVer) {
        return version;
      }
      try {
        return new SemVer(version, options);
      } catch (er) {
        if (!throwErrors) {
          return null;
        }
        throw er;
      }
    };
    module2.exports = parse;
  }
});

// node_modules/semver/functions/valid.js
var require_valid = __commonJS({
  "node_modules/semver/functions/valid.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var valid = (version, options) => {
      const v = parse(version, options);
      return v ? v.version : null;
    };
    module2.exports = valid;
  }
});

// node_modules/semver/functions/clean.js
var require_clean = __commonJS({
  "node_modules/semver/functions/clean.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var clean = (version, options) => {
      const s = parse(version.trim().replace(/^[=v]+/, ""), options);
      return s ? s.version : null;
    };
    module2.exports = clean;
  }
});

// node_modules/semver/functions/inc.js
var require_inc = __commonJS({
  "node_modules/semver/functions/inc.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var inc = (version, release, options, identifier, identifierBase) => {
      if (typeof options === "string") {
        identifierBase = identifier;
        identifier = options;
        options = void 0;
      }
      try {
        return new SemVer(
          version instanceof SemVer ? version.version : version,
          options
        ).inc(release, identifier, identifierBase).version;
      } catch (er) {
        return null;
      }
    };
    module2.exports = inc;
  }
});

// node_modules/semver/functions/diff.js
var require_diff = __commonJS({
  "node_modules/semver/functions/diff.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var diff = (version1, version2) => {
      const v1 = parse(version1, null, true);
      const v2 = parse(version2, null, true);
      const comparison = v1.compare(v2);
      if (comparison === 0) {
        return null;
      }
      const v1Higher = comparison > 0;
      const highVersion = v1Higher ? v1 : v2;
      const lowVersion = v1Higher ? v2 : v1;
      const highHasPre = !!highVersion.prerelease.length;
      const lowHasPre = !!lowVersion.prerelease.length;
      if (lowHasPre && !highHasPre) {
        if (!lowVersion.patch && !lowVersion.minor) {
          return "major";
        }
        if (lowVersion.compareMain(highVersion) === 0) {
          if (lowVersion.minor && !lowVersion.patch) {
            return "minor";
          }
          return "patch";
        }
      }
      const prefix = highHasPre ? "pre" : "";
      if (v1.major !== v2.major) {
        return prefix + "major";
      }
      if (v1.minor !== v2.minor) {
        return prefix + "minor";
      }
      if (v1.patch !== v2.patch) {
        return prefix + "patch";
      }
      return "prerelease";
    };
    module2.exports = diff;
  }
});

// node_modules/semver/functions/major.js
var require_major = __commonJS({
  "node_modules/semver/functions/major.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var major = (a, loose) => new SemVer(a, loose).major;
    module2.exports = major;
  }
});

// node_modules/semver/functions/minor.js
var require_minor = __commonJS({
  "node_modules/semver/functions/minor.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var minor = (a, loose) => new SemVer(a, loose).minor;
    module2.exports = minor;
  }
});

// node_modules/semver/functions/patch.js
var require_patch = __commonJS({
  "node_modules/semver/functions/patch.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var patch = (a, loose) => new SemVer(a, loose).patch;
    module2.exports = patch;
  }
});

// node_modules/semver/functions/prerelease.js
var require_prerelease = __commonJS({
  "node_modules/semver/functions/prerelease.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var prerelease = (version, options) => {
      const parsed = parse(version, options);
      return parsed && parsed.prerelease.length ? parsed.prerelease : null;
    };
    module2.exports = prerelease;
  }
});

// node_modules/semver/functions/compare.js
var require_compare = __commonJS({
  "node_modules/semver/functions/compare.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compare = (a, b, loose) => new SemVer(a, loose).compare(new SemVer(b, loose));
    module2.exports = compare;
  }
});

// node_modules/semver/functions/rcompare.js
var require_rcompare = __commonJS({
  "node_modules/semver/functions/rcompare.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var rcompare = (a, b, loose) => compare(b, a, loose);
    module2.exports = rcompare;
  }
});

// node_modules/semver/functions/compare-loose.js
var require_compare_loose = __commonJS({
  "node_modules/semver/functions/compare-loose.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var compareLoose = (a, b) => compare(a, b, true);
    module2.exports = compareLoose;
  }
});

// node_modules/semver/functions/compare-build.js
var require_compare_build = __commonJS({
  "node_modules/semver/functions/compare-build.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var compareBuild = (a, b, loose) => {
      const versionA = new SemVer(a, loose);
      const versionB = new SemVer(b, loose);
      return versionA.compare(versionB) || versionA.compareBuild(versionB);
    };
    module2.exports = compareBuild;
  }
});

// node_modules/semver/functions/sort.js
var require_sort = __commonJS({
  "node_modules/semver/functions/sort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var sort = (list, loose) => list.sort((a, b) => compareBuild(a, b, loose));
    module2.exports = sort;
  }
});

// node_modules/semver/functions/rsort.js
var require_rsort = __commonJS({
  "node_modules/semver/functions/rsort.js"(exports2, module2) {
    "use strict";
    var compareBuild = require_compare_build();
    var rsort = (list, loose) => list.sort((a, b) => compareBuild(b, a, loose));
    module2.exports = rsort;
  }
});

// node_modules/semver/functions/gt.js
var require_gt = __commonJS({
  "node_modules/semver/functions/gt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gt = (a, b, loose) => compare(a, b, loose) > 0;
    module2.exports = gt;
  }
});

// node_modules/semver/functions/lt.js
var require_lt = __commonJS({
  "node_modules/semver/functions/lt.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lt = (a, b, loose) => compare(a, b, loose) < 0;
    module2.exports = lt;
  }
});

// node_modules/semver/functions/eq.js
var require_eq = __commonJS({
  "node_modules/semver/functions/eq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var eq = (a, b, loose) => compare(a, b, loose) === 0;
    module2.exports = eq;
  }
});

// node_modules/semver/functions/neq.js
var require_neq = __commonJS({
  "node_modules/semver/functions/neq.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var neq = (a, b, loose) => compare(a, b, loose) !== 0;
    module2.exports = neq;
  }
});

// node_modules/semver/functions/gte.js
var require_gte = __commonJS({
  "node_modules/semver/functions/gte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var gte = (a, b, loose) => compare(a, b, loose) >= 0;
    module2.exports = gte;
  }
});

// node_modules/semver/functions/lte.js
var require_lte = __commonJS({
  "node_modules/semver/functions/lte.js"(exports2, module2) {
    "use strict";
    var compare = require_compare();
    var lte = (a, b, loose) => compare(a, b, loose) <= 0;
    module2.exports = lte;
  }
});

// node_modules/semver/functions/cmp.js
var require_cmp = __commonJS({
  "node_modules/semver/functions/cmp.js"(exports2, module2) {
    "use strict";
    var eq = require_eq();
    var neq = require_neq();
    var gt = require_gt();
    var gte = require_gte();
    var lt = require_lt();
    var lte = require_lte();
    var cmp = (a, op, b, loose) => {
      switch (op) {
        case "===":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a === b;
        case "!==":
          if (typeof a === "object") {
            a = a.version;
          }
          if (typeof b === "object") {
            b = b.version;
          }
          return a !== b;
        case "":
        case "=":
        case "==":
          return eq(a, b, loose);
        case "!=":
          return neq(a, b, loose);
        case ">":
          return gt(a, b, loose);
        case ">=":
          return gte(a, b, loose);
        case "<":
          return lt(a, b, loose);
        case "<=":
          return lte(a, b, loose);
        default:
          throw new TypeError(`Invalid operator: ${op}`);
      }
    };
    module2.exports = cmp;
  }
});

// node_modules/semver/functions/coerce.js
var require_coerce = __commonJS({
  "node_modules/semver/functions/coerce.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var parse = require_parse();
    var { safeRe: re, t } = require_re();
    var coerce = (version, options) => {
      if (version instanceof SemVer) {
        return version;
      }
      if (typeof version === "number") {
        version = String(version);
      }
      if (typeof version !== "string") {
        return null;
      }
      options = options || {};
      let match = null;
      if (!options.rtl) {
        match = version.match(options.includePrerelease ? re[t.COERCEFULL] : re[t.COERCE]);
      } else {
        const coerceRtlRegex = options.includePrerelease ? re[t.COERCERTLFULL] : re[t.COERCERTL];
        let next;
        while ((next = coerceRtlRegex.exec(version)) && (!match || match.index + match[0].length !== version.length)) {
          if (!match || next.index + next[0].length !== match.index + match[0].length) {
            match = next;
          }
          coerceRtlRegex.lastIndex = next.index + next[1].length + next[2].length;
        }
        coerceRtlRegex.lastIndex = -1;
      }
      if (match === null) {
        return null;
      }
      const major = match[2];
      const minor = match[3] || "0";
      const patch = match[4] || "0";
      const prerelease = options.includePrerelease && match[5] ? `-${match[5]}` : "";
      const build = options.includePrerelease && match[6] ? `+${match[6]}` : "";
      return parse(`${major}.${minor}.${patch}${prerelease}${build}`, options);
    };
    module2.exports = coerce;
  }
});

// node_modules/semver/functions/truncate.js
var require_truncate = __commonJS({
  "node_modules/semver/functions/truncate.js"(exports2, module2) {
    "use strict";
    var parse = require_parse();
    var constants = require_constants();
    var SemVer = require_semver();
    var truncate = (version, truncation, options) => {
      if (!constants.RELEASE_TYPES.includes(truncation)) {
        return null;
      }
      const clonedVersion = cloneInputVersion(version, options);
      return clonedVersion && doTruncation(clonedVersion, truncation);
    };
    var cloneInputVersion = (version, options) => {
      const versionStringToParse = version instanceof SemVer ? version.version : version;
      return parse(versionStringToParse, options);
    };
    var doTruncation = (version, truncation) => {
      if (isPrerelease(truncation)) {
        return version.version;
      }
      version.prerelease = [];
      switch (truncation) {
        case "major":
          version.minor = 0;
          version.patch = 0;
          break;
        case "minor":
          version.patch = 0;
          break;
      }
      return version.format();
    };
    var isPrerelease = (type) => {
      return type.startsWith("pre");
    };
    module2.exports = truncate;
  }
});

// node_modules/semver/internal/lrucache.js
var require_lrucache = __commonJS({
  "node_modules/semver/internal/lrucache.js"(exports2, module2) {
    "use strict";
    var LRUCache = class {
      constructor() {
        this.max = 1e3;
        this.map = /* @__PURE__ */ new Map();
      }
      get(key) {
        const value = this.map.get(key);
        if (value === void 0) {
          return void 0;
        } else {
          this.map.delete(key);
          this.map.set(key, value);
          return value;
        }
      }
      delete(key) {
        return this.map.delete(key);
      }
      set(key, value) {
        const deleted = this.delete(key);
        if (!deleted && value !== void 0) {
          if (this.map.size >= this.max) {
            const firstKey = this.map.keys().next().value;
            this.delete(firstKey);
          }
          this.map.set(key, value);
        }
        return this;
      }
    };
    module2.exports = LRUCache;
  }
});

// node_modules/semver/classes/range.js
var require_range = __commonJS({
  "node_modules/semver/classes/range.js"(exports2, module2) {
    "use strict";
    var SPACE_CHARACTERS = /\s+/g;
    var Range = class _Range {
      constructor(range, options) {
        options = parseOptions(options);
        if (range instanceof _Range) {
          if (range.loose === !!options.loose && range.includePrerelease === !!options.includePrerelease) {
            return range;
          } else {
            return new _Range(range.raw, options);
          }
        }
        if (range instanceof Comparator) {
          this.raw = range.value;
          this.set = [[range]];
          this.formatted = void 0;
          return this;
        }
        this.options = options;
        this.loose = !!options.loose;
        this.includePrerelease = !!options.includePrerelease;
        this.raw = range.trim().replace(SPACE_CHARACTERS, " ");
        this.set = this.raw.split("||").map((r) => this.parseRange(r.trim())).filter((c) => c.length);
        if (!this.set.length) {
          throw new TypeError(`Invalid SemVer Range: ${this.raw}`);
        }
        if (this.set.length > 1) {
          const first = this.set[0];
          this.set = this.set.filter((c) => !isNullSet(c[0]));
          if (this.set.length === 0) {
            this.set = [first];
          } else if (this.set.length > 1) {
            for (const c of this.set) {
              if (c.length === 1 && isAny(c[0])) {
                this.set = [c];
                break;
              }
            }
          }
        }
        this.formatted = void 0;
      }
      get range() {
        if (this.formatted === void 0) {
          this.formatted = "";
          for (let i = 0; i < this.set.length; i++) {
            if (i > 0) {
              this.formatted += "||";
            }
            const comps = this.set[i];
            for (let k = 0; k < comps.length; k++) {
              if (k > 0) {
                this.formatted += " ";
              }
              this.formatted += comps[k].toString().trim();
            }
          }
        }
        return this.formatted;
      }
      format() {
        return this.range;
      }
      toString() {
        return this.range;
      }
      parseRange(range) {
        range = range.replace(BUILDSTRIPRE, "");
        const memoOpts = (this.options.includePrerelease && FLAG_INCLUDE_PRERELEASE) | (this.options.loose && FLAG_LOOSE);
        const memoKey = memoOpts + ":" + range;
        const cached = cache.get(memoKey);
        if (cached) {
          return cached;
        }
        const loose = this.options.loose;
        const hr = loose ? re[t.HYPHENRANGELOOSE] : re[t.HYPHENRANGE];
        range = range.replace(hr, hyphenReplace(this.options.includePrerelease));
        debug("hyphen replace", range);
        range = range.replace(re[t.COMPARATORTRIM], comparatorTrimReplace);
        debug("comparator trim", range);
        range = range.replace(re[t.TILDETRIM], tildeTrimReplace);
        debug("tilde trim", range);
        range = range.replace(re[t.CARETTRIM], caretTrimReplace);
        debug("caret trim", range);
        let rangeList = range.split(" ").map((comp) => parseComparator(comp, this.options)).join(" ").split(/\s+/).map((comp) => replaceGTE0(comp, this.options));
        if (loose) {
          rangeList = rangeList.filter((comp) => {
            debug("loose invalid filter", comp, this.options);
            return !!comp.match(re[t.COMPARATORLOOSE]);
          });
        }
        debug("range list", rangeList);
        const rangeMap = /* @__PURE__ */ new Map();
        const comparators = rangeList.map((comp) => new Comparator(comp, this.options));
        for (const comp of comparators) {
          if (isNullSet(comp)) {
            return [comp];
          }
          rangeMap.set(comp.value, comp);
        }
        if (rangeMap.size > 1 && rangeMap.has("")) {
          rangeMap.delete("");
        }
        const result = [...rangeMap.values()];
        cache.set(memoKey, result);
        return result;
      }
      intersects(range, options) {
        if (!(range instanceof _Range)) {
          throw new TypeError("a Range is required");
        }
        return this.set.some((thisComparators) => {
          return isSatisfiable(thisComparators, options) && range.set.some((rangeComparators) => {
            return isSatisfiable(rangeComparators, options) && thisComparators.every((thisComparator) => {
              return rangeComparators.every((rangeComparator) => {
                return thisComparator.intersects(rangeComparator, options);
              });
            });
          });
        });
      }
      // if ANY of the sets match ALL of its comparators, then pass
      test(version) {
        if (!version) {
          return false;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        for (let i = 0; i < this.set.length; i++) {
          if (testSet(this.set[i], version, this.options)) {
            return true;
          }
        }
        return false;
      }
    };
    module2.exports = Range;
    var LRU = require_lrucache();
    var cache = new LRU();
    var parseOptions = require_parse_options();
    var Comparator = require_comparator();
    var debug = require_debug();
    var SemVer = require_semver();
    var {
      safeRe: re,
      src,
      t,
      comparatorTrimReplace,
      tildeTrimReplace,
      caretTrimReplace
    } = require_re();
    var { FLAG_INCLUDE_PRERELEASE, FLAG_LOOSE } = require_constants();
    var BUILDSTRIPRE = new RegExp(src[t.BUILD], "g");
    var isNullSet = (c) => c.value === "<0.0.0-0";
    var isAny = (c) => c.value === "";
    var isSatisfiable = (comparators, options) => {
      let result = true;
      const remainingComparators = comparators.slice();
      let testComparator = remainingComparators.pop();
      while (result && remainingComparators.length) {
        result = remainingComparators.every((otherComparator) => {
          return testComparator.intersects(otherComparator, options);
        });
        testComparator = remainingComparators.pop();
      }
      return result;
    };
    var parseComparator = (comp, options) => {
      comp = comp.replace(re[t.BUILD], "");
      debug("comp", comp, options);
      comp = replaceCarets(comp, options);
      debug("caret", comp);
      comp = replaceTildes(comp, options);
      debug("tildes", comp);
      comp = replaceXRanges(comp, options);
      debug("xrange", comp);
      comp = replaceStars(comp, options);
      debug("stars", comp);
      return comp;
    };
    var isX = (id) => !id || id.toLowerCase() === "x" || id === "*";
    var invalidXRangeOrder = (M, m, p) => isX(M) && !isX(m) || isX(m) && p && !isX(p);
    var replaceTildes = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceTilde(c, options)).join(" ");
    };
    var replaceTilde = (comp, options) => {
      const r = options.loose ? re[t.TILDELOOSE] : re[t.TILDE];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("tilde", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
        } else if (pr) {
          debug("replaceTilde pr", pr);
          ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
        } else {
          ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
        }
        debug("tilde return", ret);
        return ret;
      });
    };
    var replaceCarets = (comp, options) => {
      return comp.trim().split(/\s+/).map((c) => replaceCaret(c, options)).join(" ");
    };
    var replaceCaret = (comp, options) => {
      debug("caret", comp, options);
      const r = options.loose ? re[t.CARETLOOSE] : re[t.CARET];
      const z = options.includePrerelease ? "-0" : "";
      return comp.replace(r, (_, M, m, p, pr) => {
        debug("caret", comp, _, M, m, p, pr);
        let ret;
        if (isX(M)) {
          ret = "";
        } else if (isX(m)) {
          ret = `>=${M}.0.0${z} <${+M + 1}.0.0-0`;
        } else if (isX(p)) {
          if (M === "0") {
            ret = `>=${M}.${m}.0${z} <${M}.${+m + 1}.0-0`;
          } else {
            ret = `>=${M}.${m}.0${z} <${+M + 1}.0.0-0`;
          }
        } else if (pr) {
          debug("replaceCaret pr", pr);
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p}-${pr} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p}-${pr} <${+M + 1}.0.0-0`;
          }
        } else {
          debug("no pr");
          if (M === "0") {
            if (m === "0") {
              ret = `>=${M}.${m}.${p} <${M}.${m}.${+p + 1}-0`;
            } else {
              ret = `>=${M}.${m}.${p} <${M}.${+m + 1}.0-0`;
            }
          } else {
            ret = `>=${M}.${m}.${p} <${+M + 1}.0.0-0`;
          }
        }
        debug("caret return", ret);
        return ret;
      });
    };
    var replaceXRanges = (comp, options) => {
      debug("replaceXRanges", comp, options);
      return comp.split(/\s+/).map((c) => replaceXRange(c, options)).join(" ");
    };
    var replaceXRange = (comp, options) => {
      comp = comp.trim();
      const r = options.loose ? re[t.XRANGELOOSE] : re[t.XRANGE];
      return comp.replace(r, (ret, gtlt, M, m, p, pr) => {
        debug("xRange", comp, ret, gtlt, M, m, p, pr);
        if (invalidXRangeOrder(M, m, p)) {
          return comp;
        }
        const xM = isX(M);
        const xm = xM || isX(m);
        const xp = xm || isX(p);
        const anyX = xp;
        if (gtlt === "=" && anyX) {
          gtlt = "";
        }
        pr = options.includePrerelease ? "-0" : "";
        if (xM) {
          if (gtlt === ">" || gtlt === "<") {
            ret = "<0.0.0-0";
          } else {
            ret = "*";
          }
        } else if (gtlt && anyX) {
          if (xm) {
            m = 0;
          }
          p = 0;
          if (gtlt === ">") {
            gtlt = ">=";
            if (xm) {
              M = +M + 1;
              m = 0;
              p = 0;
            } else {
              m = +m + 1;
              p = 0;
            }
          } else if (gtlt === "<=") {
            gtlt = "<";
            if (xm) {
              M = +M + 1;
            } else {
              m = +m + 1;
            }
          }
          if (gtlt === "<") {
            pr = "-0";
          }
          ret = `${gtlt + M}.${m}.${p}${pr}`;
        } else if (xm) {
          ret = `>=${M}.0.0${pr} <${+M + 1}.0.0-0`;
        } else if (xp) {
          ret = `>=${M}.${m}.0${pr} <${M}.${+m + 1}.0-0`;
        }
        debug("xRange return", ret);
        return ret;
      });
    };
    var replaceStars = (comp, options) => {
      debug("replaceStars", comp, options);
      return comp.trim().replace(re[t.STAR], "");
    };
    var replaceGTE0 = (comp, options) => {
      debug("replaceGTE0", comp, options);
      return comp.trim().replace(re[options.includePrerelease ? t.GTE0PRE : t.GTE0], "");
    };
    var hyphenReplace = (incPr) => ($0, from, fM, fm, fp, fpr, fb, to, tM, tm, tp, tpr) => {
      if (isX(fM)) {
        from = "";
      } else if (isX(fm)) {
        from = `>=${fM}.0.0${incPr ? "-0" : ""}`;
      } else if (isX(fp)) {
        from = `>=${fM}.${fm}.0${incPr ? "-0" : ""}`;
      } else if (fpr) {
        from = `>=${from}`;
      } else {
        from = `>=${from}${incPr ? "-0" : ""}`;
      }
      if (isX(tM)) {
        to = "";
      } else if (isX(tm)) {
        to = `<${+tM + 1}.0.0-0`;
      } else if (isX(tp)) {
        to = `<${tM}.${+tm + 1}.0-0`;
      } else if (tpr) {
        to = `<=${tM}.${tm}.${tp}-${tpr}`;
      } else if (incPr) {
        to = `<${tM}.${tm}.${+tp + 1}-0`;
      } else {
        to = `<=${to}`;
      }
      return `${from} ${to}`.trim();
    };
    var testSet = (set, version, options) => {
      for (let i = 0; i < set.length; i++) {
        if (!set[i].test(version)) {
          return false;
        }
      }
      if (version.prerelease.length && !options.includePrerelease) {
        for (let i = 0; i < set.length; i++) {
          debug(set[i].semver);
          if (set[i].semver === Comparator.ANY) {
            continue;
          }
          if (set[i].semver.prerelease.length > 0) {
            const allowed = set[i].semver;
            if (allowed.major === version.major && allowed.minor === version.minor && allowed.patch === version.patch) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    };
  }
});

// node_modules/semver/classes/comparator.js
var require_comparator = __commonJS({
  "node_modules/semver/classes/comparator.js"(exports2, module2) {
    "use strict";
    var ANY = /* @__PURE__ */ Symbol("SemVer ANY");
    var Comparator = class _Comparator {
      static get ANY() {
        return ANY;
      }
      constructor(comp, options) {
        options = parseOptions(options);
        if (comp instanceof _Comparator) {
          if (comp.loose === !!options.loose) {
            return comp;
          } else {
            comp = comp.value;
          }
        }
        comp = comp.trim().split(/\s+/).join(" ");
        debug("comparator", comp, options);
        this.options = options;
        this.loose = !!options.loose;
        this.parse(comp);
        if (this.semver === ANY) {
          this.value = "";
        } else {
          this.value = this.operator + this.semver.version;
        }
        debug("comp", this);
      }
      parse(comp) {
        const r = this.options.loose ? re[t.COMPARATORLOOSE] : re[t.COMPARATOR];
        const m = comp.match(r);
        if (!m) {
          throw new TypeError(`Invalid comparator: ${comp}`);
        }
        this.operator = m[1] !== void 0 ? m[1] : "";
        if (this.operator === "=") {
          this.operator = "";
        }
        if (!m[2]) {
          this.semver = ANY;
        } else {
          this.semver = new SemVer(m[2], this.options.loose);
        }
      }
      toString() {
        return this.value;
      }
      test(version) {
        debug("Comparator.test", version, this.options.loose);
        if (this.semver === ANY || version === ANY) {
          return true;
        }
        if (typeof version === "string") {
          try {
            version = new SemVer(version, this.options);
          } catch (er) {
            return false;
          }
        }
        return cmp(version, this.operator, this.semver, this.options);
      }
      intersects(comp, options) {
        if (!(comp instanceof _Comparator)) {
          throw new TypeError("a Comparator is required");
        }
        if (this.operator === "") {
          if (this.value === "") {
            return true;
          }
          return new Range(comp.value, options).test(this.value);
        } else if (comp.operator === "") {
          if (comp.value === "") {
            return true;
          }
          return new Range(this.value, options).test(comp.semver);
        }
        options = parseOptions(options);
        if (options.includePrerelease && (this.value === "<0.0.0-0" || comp.value === "<0.0.0-0")) {
          return false;
        }
        if (!options.includePrerelease && (this.value.startsWith("<0.0.0") || comp.value.startsWith("<0.0.0"))) {
          return false;
        }
        if (this.operator.startsWith(">") && comp.operator.startsWith(">")) {
          return true;
        }
        if (this.operator.startsWith("<") && comp.operator.startsWith("<")) {
          return true;
        }
        if (this.semver.version === comp.semver.version && this.operator.includes("=") && comp.operator.includes("=")) {
          return true;
        }
        if (cmp(this.semver, "<", comp.semver, options) && this.operator.startsWith(">") && comp.operator.startsWith("<")) {
          return true;
        }
        if (cmp(this.semver, ">", comp.semver, options) && this.operator.startsWith("<") && comp.operator.startsWith(">")) {
          return true;
        }
        return false;
      }
    };
    module2.exports = Comparator;
    var parseOptions = require_parse_options();
    var { safeRe: re, t } = require_re();
    var cmp = require_cmp();
    var debug = require_debug();
    var SemVer = require_semver();
    var Range = require_range();
  }
});

// node_modules/semver/functions/satisfies.js
var require_satisfies = __commonJS({
  "node_modules/semver/functions/satisfies.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var satisfies = (version, range, options) => {
      try {
        range = new Range(range, options);
      } catch (er) {
        return false;
      }
      return range.test(version);
    };
    module2.exports = satisfies;
  }
});

// node_modules/semver/ranges/to-comparators.js
var require_to_comparators = __commonJS({
  "node_modules/semver/ranges/to-comparators.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var toComparators = (range, options) => new Range(range, options).set.map((comp) => comp.map((c) => c.value).join(" ").trim().split(" "));
    module2.exports = toComparators;
  }
});

// node_modules/semver/ranges/max-satisfying.js
var require_max_satisfying = __commonJS({
  "node_modules/semver/ranges/max-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var maxSatisfying = (versions, range, options) => {
      let max = null;
      let maxSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!max || maxSV.compare(v) === -1) {
            max = v;
            maxSV = new SemVer(max, options);
          }
        }
      });
      return max;
    };
    module2.exports = maxSatisfying;
  }
});

// node_modules/semver/ranges/min-satisfying.js
var require_min_satisfying = __commonJS({
  "node_modules/semver/ranges/min-satisfying.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var minSatisfying = (versions, range, options) => {
      let min = null;
      let minSV = null;
      let rangeObj = null;
      try {
        rangeObj = new Range(range, options);
      } catch (er) {
        return null;
      }
      versions.forEach((v) => {
        if (rangeObj.test(v)) {
          if (!min || minSV.compare(v) === 1) {
            min = v;
            minSV = new SemVer(min, options);
          }
        }
      });
      return min;
    };
    module2.exports = minSatisfying;
  }
});

// node_modules/semver/ranges/min-version.js
var require_min_version = __commonJS({
  "node_modules/semver/ranges/min-version.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Range = require_range();
    var gt = require_gt();
    var minVersion = (range, loose) => {
      range = new Range(range, loose);
      let minver = new SemVer("0.0.0");
      if (range.test(minver)) {
        return minver;
      }
      minver = new SemVer("0.0.0-0");
      if (range.test(minver)) {
        return minver;
      }
      minver = null;
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let setMin = null;
        comparators.forEach((comparator) => {
          const compver = new SemVer(comparator.semver.version);
          switch (comparator.operator) {
            case ">":
              if (compver.prerelease.length === 0) {
                compver.patch++;
              } else {
                compver.prerelease.push(0);
              }
              compver.raw = compver.format();
            /* fallthrough */
            case "":
            case ">=":
              if (!setMin || gt(compver, setMin)) {
                setMin = compver;
              }
              break;
            case "<":
            case "<=":
              break;
            /* istanbul ignore next */
            default:
              throw new Error(`Unexpected operation: ${comparator.operator}`);
          }
        });
        if (setMin && (!minver || gt(minver, setMin))) {
          minver = setMin;
        }
      }
      if (minver && range.test(minver)) {
        return minver;
      }
      return null;
    };
    module2.exports = minVersion;
  }
});

// node_modules/semver/ranges/valid.js
var require_valid2 = __commonJS({
  "node_modules/semver/ranges/valid.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var validRange = (range, options) => {
      try {
        return new Range(range, options).range || "*";
      } catch (er) {
        return null;
      }
    };
    module2.exports = validRange;
  }
});

// node_modules/semver/ranges/outside.js
var require_outside = __commonJS({
  "node_modules/semver/ranges/outside.js"(exports2, module2) {
    "use strict";
    var SemVer = require_semver();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var Range = require_range();
    var satisfies = require_satisfies();
    var gt = require_gt();
    var lt = require_lt();
    var lte = require_lte();
    var gte = require_gte();
    var outside = (version, range, hilo, options) => {
      version = new SemVer(version, options);
      range = new Range(range, options);
      let gtfn, ltefn, ltfn, comp, ecomp;
      switch (hilo) {
        case ">":
          gtfn = gt;
          ltefn = lte;
          ltfn = lt;
          comp = ">";
          ecomp = ">=";
          break;
        case "<":
          gtfn = lt;
          ltefn = gte;
          ltfn = gt;
          comp = "<";
          ecomp = "<=";
          break;
        default:
          throw new TypeError('Must provide a hilo val of "<" or ">"');
      }
      if (satisfies(version, range, options)) {
        return false;
      }
      for (let i = 0; i < range.set.length; ++i) {
        const comparators = range.set[i];
        let high = null;
        let low = null;
        comparators.forEach((comparator) => {
          if (comparator.semver === ANY) {
            comparator = new Comparator(">=0.0.0");
          }
          high = high || comparator;
          low = low || comparator;
          if (gtfn(comparator.semver, high.semver, options)) {
            high = comparator;
          } else if (ltfn(comparator.semver, low.semver, options)) {
            low = comparator;
          }
        });
        if (high.operator === comp || high.operator === ecomp) {
          return false;
        }
        if ((!low.operator || low.operator === comp) && ltefn(version, low.semver)) {
          return false;
        } else if (low.operator === ecomp && ltfn(version, low.semver)) {
          return false;
        }
      }
      return true;
    };
    module2.exports = outside;
  }
});

// node_modules/semver/ranges/gtr.js
var require_gtr = __commonJS({
  "node_modules/semver/ranges/gtr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var gtr = (version, range, options) => outside(version, range, ">", options);
    module2.exports = gtr;
  }
});

// node_modules/semver/ranges/ltr.js
var require_ltr = __commonJS({
  "node_modules/semver/ranges/ltr.js"(exports2, module2) {
    "use strict";
    var outside = require_outside();
    var ltr = (version, range, options) => outside(version, range, "<", options);
    module2.exports = ltr;
  }
});

// node_modules/semver/ranges/intersects.js
var require_intersects = __commonJS({
  "node_modules/semver/ranges/intersects.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var intersects = (r1, r2, options) => {
      r1 = new Range(r1, options);
      r2 = new Range(r2, options);
      return r1.intersects(r2, options);
    };
    module2.exports = intersects;
  }
});

// node_modules/semver/ranges/simplify.js
var require_simplify = __commonJS({
  "node_modules/semver/ranges/simplify.js"(exports2, module2) {
    "use strict";
    var satisfies = require_satisfies();
    var compare = require_compare();
    module2.exports = (versions, range, options) => {
      const set = [];
      let first = null;
      let prev = null;
      const v = versions.sort((a, b) => compare(a, b, options));
      for (const version of v) {
        const included = satisfies(version, range, options);
        if (included) {
          prev = version;
          if (!first) {
            first = version;
          }
        } else {
          if (prev) {
            set.push([first, prev]);
          }
          prev = null;
          first = null;
        }
      }
      if (first) {
        set.push([first, null]);
      }
      const ranges = [];
      for (const [min, max] of set) {
        if (min === max) {
          ranges.push(min);
        } else if (!max && min === v[0]) {
          ranges.push("*");
        } else if (!max) {
          ranges.push(`>=${min}`);
        } else if (min === v[0]) {
          ranges.push(`<=${max}`);
        } else {
          ranges.push(`${min} - ${max}`);
        }
      }
      const simplified = ranges.join(" || ");
      const original = typeof range.raw === "string" ? range.raw : String(range);
      return simplified.length < original.length ? simplified : range;
    };
  }
});

// node_modules/semver/ranges/subset.js
var require_subset = __commonJS({
  "node_modules/semver/ranges/subset.js"(exports2, module2) {
    "use strict";
    var Range = require_range();
    var Comparator = require_comparator();
    var { ANY } = Comparator;
    var satisfies = require_satisfies();
    var compare = require_compare();
    var subset = (sub, dom, options = {}) => {
      if (sub === dom) {
        return true;
      }
      sub = new Range(sub, options);
      dom = new Range(dom, options);
      let sawNonNull = false;
      OUTER: for (const simpleSub of sub.set) {
        for (const simpleDom of dom.set) {
          const isSub = simpleSubset(simpleSub, simpleDom, options);
          sawNonNull = sawNonNull || isSub !== null;
          if (isSub) {
            continue OUTER;
          }
        }
        if (sawNonNull) {
          return false;
        }
      }
      return true;
    };
    var minimumVersionWithPreRelease = [new Comparator(">=0.0.0-0")];
    var minimumVersion = [new Comparator(">=0.0.0")];
    var simpleSubset = (sub, dom, options) => {
      if (sub === dom) {
        return true;
      }
      if (sub.length === 1 && sub[0].semver === ANY) {
        if (dom.length === 1 && dom[0].semver === ANY) {
          return true;
        } else if (options.includePrerelease) {
          sub = minimumVersionWithPreRelease;
        } else {
          sub = minimumVersion;
        }
      }
      if (dom.length === 1 && dom[0].semver === ANY) {
        if (options.includePrerelease) {
          return true;
        } else {
          dom = minimumVersion;
        }
      }
      const eqSet = /* @__PURE__ */ new Set();
      let gt, lt;
      for (const c of sub) {
        if (c.operator === ">" || c.operator === ">=") {
          gt = higherGT(gt, c, options);
        } else if (c.operator === "<" || c.operator === "<=") {
          lt = lowerLT(lt, c, options);
        } else {
          eqSet.add(c.semver);
        }
      }
      if (eqSet.size > 1) {
        return null;
      }
      let gtltComp;
      if (gt && lt) {
        gtltComp = compare(gt.semver, lt.semver, options);
        if (gtltComp > 0) {
          return null;
        } else if (gtltComp === 0 && (gt.operator !== ">=" || lt.operator !== "<=")) {
          return null;
        }
      }
      for (const eq of eqSet) {
        if (gt && !satisfies(eq, String(gt), options)) {
          return null;
        }
        if (lt && !satisfies(eq, String(lt), options)) {
          return null;
        }
        for (const c of dom) {
          if (!satisfies(eq, String(c), options)) {
            return false;
          }
        }
        return true;
      }
      let higher, lower;
      let hasDomLT, hasDomGT;
      let needDomLTPre = lt && !options.includePrerelease && lt.semver.prerelease.length ? lt.semver : false;
      let needDomGTPre = gt && !options.includePrerelease && gt.semver.prerelease.length ? gt.semver : false;
      if (needDomLTPre && needDomLTPre.prerelease.length === 1 && lt.operator === "<" && needDomLTPre.prerelease[0] === 0) {
        needDomLTPre = false;
      }
      for (const c of dom) {
        hasDomGT = hasDomGT || c.operator === ">" || c.operator === ">=";
        hasDomLT = hasDomLT || c.operator === "<" || c.operator === "<=";
        if (gt) {
          if (needDomGTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomGTPre.major && c.semver.minor === needDomGTPre.minor && c.semver.patch === needDomGTPre.patch) {
              needDomGTPre = false;
            }
          }
          if (c.operator === ">" || c.operator === ">=") {
            higher = higherGT(gt, c, options);
            if (higher === c && higher !== gt) {
              return false;
            }
          } else if (gt.operator === ">=" && !c.test(gt.semver)) {
            return false;
          }
        }
        if (lt) {
          if (needDomLTPre) {
            if (c.semver.prerelease && c.semver.prerelease.length && c.semver.major === needDomLTPre.major && c.semver.minor === needDomLTPre.minor && c.semver.patch === needDomLTPre.patch) {
              needDomLTPre = false;
            }
          }
          if (c.operator === "<" || c.operator === "<=") {
            lower = lowerLT(lt, c, options);
            if (lower === c && lower !== lt) {
              return false;
            }
          } else if (lt.operator === "<=" && !c.test(lt.semver)) {
            return false;
          }
        }
        if (!c.operator && (lt || gt) && gtltComp !== 0) {
          return false;
        }
      }
      if (gt && hasDomLT && !lt && gtltComp !== 0) {
        return false;
      }
      if (lt && hasDomGT && !gt && gtltComp !== 0) {
        return false;
      }
      if (needDomGTPre || needDomLTPre) {
        return false;
      }
      return true;
    };
    var higherGT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp > 0 ? a : comp < 0 ? b : b.operator === ">" && a.operator === ">=" ? b : a;
    };
    var lowerLT = (a, b, options) => {
      if (!a) {
        return b;
      }
      const comp = compare(a.semver, b.semver, options);
      return comp < 0 ? a : comp > 0 ? b : b.operator === "<" && a.operator === "<=" ? b : a;
    };
    module2.exports = subset;
  }
});

// node_modules/semver/index.js
var require_semver2 = __commonJS({
  "node_modules/semver/index.js"(exports2, module2) {
    "use strict";
    var internalRe = require_re();
    var constants = require_constants();
    var SemVer = require_semver();
    var identifiers = require_identifiers();
    var parse = require_parse();
    var valid = require_valid();
    var clean = require_clean();
    var inc = require_inc();
    var diff = require_diff();
    var major = require_major();
    var minor = require_minor();
    var patch = require_patch();
    var prerelease = require_prerelease();
    var compare = require_compare();
    var rcompare = require_rcompare();
    var compareLoose = require_compare_loose();
    var compareBuild = require_compare_build();
    var sort = require_sort();
    var rsort = require_rsort();
    var gt = require_gt();
    var lt = require_lt();
    var eq = require_eq();
    var neq = require_neq();
    var gte = require_gte();
    var lte = require_lte();
    var cmp = require_cmp();
    var coerce = require_coerce();
    var truncate = require_truncate();
    var Comparator = require_comparator();
    var Range = require_range();
    var satisfies = require_satisfies();
    var toComparators = require_to_comparators();
    var maxSatisfying = require_max_satisfying();
    var minSatisfying = require_min_satisfying();
    var minVersion = require_min_version();
    var validRange = require_valid2();
    var outside = require_outside();
    var gtr = require_gtr();
    var ltr = require_ltr();
    var intersects = require_intersects();
    var simplifyRange = require_simplify();
    var subset = require_subset();
    module2.exports = {
      parse,
      valid,
      clean,
      inc,
      diff,
      major,
      minor,
      patch,
      prerelease,
      compare,
      rcompare,
      compareLoose,
      compareBuild,
      sort,
      rsort,
      gt,
      lt,
      eq,
      neq,
      gte,
      lte,
      cmp,
      coerce,
      truncate,
      Comparator,
      Range,
      satisfies,
      toComparators,
      maxSatisfying,
      minSatisfying,
      minVersion,
      validRange,
      outside,
      gtr,
      ltr,
      intersects,
      simplifyRange,
      subset,
      SemVer,
      re: internalRe.re,
      src: internalRe.src,
      tokens: internalRe.t,
      SEMVER_SPEC_VERSION: constants.SEMVER_SPEC_VERSION,
      RELEASE_TYPES: constants.RELEASE_TYPES,
      compareIdentifiers: identifiers.compareIdentifiers,
      rcompareIdentifiers: identifiers.rcompareIdentifiers
    };
  }
});

// src/db.json
var require_db = __commonJS({
  "src/db.json"(exports2, module2) {
    module2.exports = {
      "@vue/language-tools": {
        reason: "Uses TypeScript Compiler API programmatic layer, absent in TypeScript 7.0 until 7.1",
        fix: "Pin typescript to ^6.x, or install @typescript/typescript6 and configure alias"
      },
      volar: {
        reason: "Same as @vue/language-tools (predecessor package)",
        fix: "Pin typescript to ^6.x"
      },
      "@volar/typescript": {
        reason: "Uses TypeScript Compiler API",
        fix: "Pin typescript to ^6.x"
      },
      "@astrojs/language-server": {
        reason: "Uses TypeScript Compiler API for Astro template type-checking",
        fix: "Pin typescript to ^6.x"
      },
      "svelte-language-server": {
        reason: "Uses TypeScript Compiler API for Svelte template type-checking",
        fix: "Pin typescript to ^6.x"
      },
      "@angular/compiler-cli": {
        reason: "Uses TypeScript Compiler API for Angular template type-checking",
        fix: "Pin typescript to ^6.x"
      },
      "ts-node": {
        reason: "Wraps TypeScript Compiler API for runtime transpilation",
        fix: "Use tsx or swc-node as replacements, or pin typescript to ^6.x"
      },
      "ts-morph": {
        reason: "Built entirely on the TypeScript Compiler API",
        fix: "Wait for ts-morph TypeScript 7.1 support or pin typescript to ^6.x"
      },
      "@mdx-js/mdx": {
        reason: "MDX type-checking embeds the TypeScript Compiler API, absent in TypeScript 7.0 until 7.1",
        fix: "Pin typescript to ^6.x"
      },
      "typescript-eslint": {
        reason: "typescript-eslint reads types via the TypeScript Compiler API, which TypeScript 7.0 does not export until 7.1",
        fix: "Run typescript-eslint against @typescript/typescript6 side-by-side, or pin typescript to ^6.x"
      },
      "@typescript-eslint/typescript-estree": {
        reason: "Parses and type-resolves via the TypeScript Compiler API, absent in TypeScript 7.0 until 7.1",
        fix: "Install @typescript/typescript6 side-by-side, or pin typescript to ^6.x"
      },
      "vue-tsc": {
        reason: "Wraps the TypeScript Compiler API (via Volar) to type-check Vue SFC templates",
        fix: "Pin typescript to ^6.x, or install @typescript/typescript6 and run tsc6"
      },
      "svelte-check": {
        reason: "Uses the TypeScript Compiler API (via svelte-language-server) to type-check Svelte templates",
        fix: "Pin typescript to ^6.x"
      },
      "@astrojs/check": {
        reason: "Astro's type-check CLI drives the TypeScript Compiler API (via @astrojs/language-server)",
        fix: "Pin typescript to ^6.x"
      },
      "@typescript-eslint/parser": {
        reason: "Parses and type-resolves via the TypeScript Compiler API, absent in TypeScript 7.0 until 7.1",
        fix: "Run against @typescript/typescript6 side-by-side, or pin typescript to ^6.x"
      },
      "ts-loader": {
        reason: "webpack loader that calls the TypeScript Compiler API (createProgram / transpileModule) to compile and type-check",
        fix: "Switch to esbuild-loader or swc-loader, or pin typescript to ^6.x"
      },
      "fork-ts-checker-webpack-plugin": {
        reason: "Runs a full TypeScript type-check via the Compiler API in a worker process",
        fix: "Pin typescript to ^6.x until the plugin targets the TypeScript 7.1 API"
      },
      "rollup-plugin-typescript2": {
        reason: "Rollup plugin built on the TypeScript Compiler API (language service) for compile + type-check",
        fix: "Use @rollup/plugin-typescript in transpile-only mode with esbuild/swc, or pin typescript to ^6.x"
      },
      "@rollup/plugin-typescript": {
        reason: "Invokes the TypeScript Compiler API to emit and type-check during Rollup builds",
        fix: "Switch emit to esbuild/swc and type-check separately, or pin typescript to ^6.x"
      },
      "ts-jest": {
        reason: "Compiles and type-checks test files through the TypeScript Compiler API",
        fix: "Use @swc/jest or babel-jest for transform, or pin typescript to ^6.x"
      },
      "@microsoft/api-extractor": {
        reason: "Analyzes .d.ts rollups via the TypeScript Compiler API",
        fix: "Pin typescript to ^6.x until api-extractor supports the TypeScript 7.1 API"
      },
      typedoc: {
        reason: "Reads program symbols and types via the TypeScript Compiler API to generate docs",
        fix: "Pin typescript to ^6.x until TypeDoc supports the TypeScript 7.1 API"
      },
      "dts-bundle-generator": {
        reason: "Builds bundled type declarations via the TypeScript Compiler API",
        fix: "Pin typescript to ^6.x"
      },
      tsd: {
        reason: "Runs type assertions by driving the TypeScript Compiler API",
        fix: "Pin typescript to ^6.x"
      },
      tsup: {
        reason: 'Generates .d.ts through the TypeScript Compiler API; its declaration step crashes on 7.0 with "Cannot read properties of undefined (reading useCaseSensitiveFileNames)"',
        fix: "Build with `--dts false` and emit declarations via tsc, or pin typescript to ^6.x until tsup supports the native compiler"
      }
    };
  }
});

// src/tsconfig.js
var require_tsconfig = __commonJS({
  "src/tsconfig.js"(exports2, module2) {
    "use strict";
    var fs2 = require("node:fs");
    var path2 = require("node:path");
    var HELP_URI = "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/";
    var DECORATORS_URI = "https://github.com/microsoft/typescript-go/discussions/741";
    var REMOVED_OPTIONS = [
      {
        id: "target-es5",
        key: "target",
        test: (o) => {
          const v = typeof o.target === "string" ? o.target.toLowerCase() : null;
          return v === "es5" || v === "es3" ? o.target : null;
        },
        title: 'target "ES5"/"ES3" removed',
        reason: 'TypeScript 7.0 drops down-level emit below ES2015; `target: "es5"`/`"es3"` is no longer supported (minimum output is modern ES).',
        fix: "Raise `target` to `es2015` or later (e.g. `es2022`). Down-level to ES5 with a separate tool (esbuild/swc/Babel) if you still need it."
      },
      {
        id: "downlevel-iteration",
        key: "downlevelIteration",
        test: (o) => o.downlevelIteration ? true : null,
        title: "downlevelIteration removed",
        reason: "`downlevelIteration` only applied to pre-ES2015 targets, which TypeScript 7.0 no longer supports, so the option is removed.",
        fix: "Remove `downlevelIteration` and target `es2015`+ (native iteration)."
      },
      {
        id: "module-legacy",
        key: "module",
        test: (o) => {
          const v = typeof o.module === "string" ? o.module.toLowerCase() : null;
          return v === "amd" || v === "umd" || v === "system" || v === "systemjs" || v === "none" ? o.module : null;
        },
        title: "legacy module format removed",
        reason: "The `amd`, `umd`, `system` and `none` module formats are removed in TypeScript 7.0.",
        fix: "Use `esnext` (or `preserve`) and let a bundler produce the legacy format if you still need one."
      },
      {
        id: "module-resolution-legacy",
        key: "moduleResolution",
        test: (o) => {
          const v = typeof o.moduleResolution === "string" ? o.moduleResolution.toLowerCase() : null;
          return v === "node" || v === "node10" || v === "classic" ? o.moduleResolution : null;
        },
        title: 'moduleResolution "node"/"node10"/"classic" removed',
        reason: "The legacy `node` (a.k.a. `node10`) and `classic` resolution modes are removed in TypeScript 7.0.",
        fix: 'Use `moduleResolution: "bundler"` (apps/bundlers) or `"nodenext"` (Node ESM/CJS).'
      },
      {
        id: "base-url",
        key: "baseUrl",
        test: (o) => o.baseUrl != null ? o.baseUrl : null,
        title: "baseUrl removed",
        reason: "`baseUrl` is removed in TypeScript 7.0; path mapping is now resolved relative to the tsconfig.json location.",
        fix: 'Delete `baseUrl` and rewrite `paths` entries relative to the config file (e.g. `"@/*": ["./src/*"]`).'
      },
      {
        id: "es-module-interop-false",
        key: "esModuleInterop",
        test: (o) => o.esModuleInterop === false ? false : null,
        title: "esModuleInterop cannot be disabled",
        reason: "TypeScript 7.0 assumes `esModuleInterop: true`; explicitly setting it to `false` is no longer allowed.",
        fix: 'Remove `"esModuleInterop": false` (the default is now `true`).'
      },
      {
        id: "allow-synthetic-default-imports-false",
        key: "allowSyntheticDefaultImports",
        test: (o) => o.allowSyntheticDefaultImports === false ? false : null,
        title: "allowSyntheticDefaultImports cannot be disabled",
        reason: "`allowSyntheticDefaultImports` is implied by the new interop model and can no longer be set to `false`.",
        fix: 'Remove `"allowSyntheticDefaultImports": false`.'
      },
      {
        id: "always-strict-false",
        key: "alwaysStrict",
        test: (o) => o.alwaysStrict === false ? false : null,
        title: "alwaysStrict cannot be disabled",
        reason: "Emitted modules are always in strict mode in TypeScript 7.0; `alwaysStrict: false` is rejected.",
        fix: 'Remove `"alwaysStrict": false`.'
      },
      {
        id: "out",
        key: "out",
        test: (o) => o.out != null ? o.out : null,
        title: "out removed (use outFile)",
        reason: "The legacy `out` option (superseded by `outFile` years ago) is removed in TypeScript 7.0.",
        fix: "Replace `out` with `outFile`, or emit with a bundler."
      },
      {
        id: "imports-not-used-as-values",
        key: "importsNotUsedAsValues",
        test: (o) => o.importsNotUsedAsValues != null ? o.importsNotUsedAsValues : null,
        title: "importsNotUsedAsValues removed",
        reason: "`importsNotUsedAsValues` was deprecated in favour of `verbatimModuleSyntax` and is removed in TypeScript 7.0.",
        fix: 'Remove it and set `"verbatimModuleSyntax": true` if you need explicit type-only import elision.'
      },
      {
        id: "preserve-value-imports",
        key: "preserveValueImports",
        test: (o) => o.preserveValueImports != null ? o.preserveValueImports : null,
        title: "preserveValueImports removed",
        reason: "`preserveValueImports` was folded into `verbatimModuleSyntax` and is removed in TypeScript 7.0.",
        fix: 'Remove it and use `"verbatimModuleSyntax": true`.'
      },
      {
        id: "keyof-strings-only",
        key: "keyofStringsOnly",
        test: (o) => o.keyofStringsOnly != null ? o.keyofStringsOnly : null,
        title: "keyofStringsOnly removed",
        reason: "`keyofStringsOnly` (a legacy TypeScript 2.9 flag) is removed in TypeScript 7.0.",
        fix: "Remove `keyofStringsOnly`."
      },
      {
        id: "no-implicit-use-strict",
        key: "noImplicitUseStrict",
        test: (o) => o.noImplicitUseStrict != null ? o.noImplicitUseStrict : null,
        title: "noImplicitUseStrict removed",
        reason: "`noImplicitUseStrict` is removed in TypeScript 7.0.",
        fix: "Remove `noImplicitUseStrict`."
      },
      {
        id: "no-strict-generic-checks",
        key: "noStrictGenericChecks",
        test: (o) => o.noStrictGenericChecks != null ? o.noStrictGenericChecks : null,
        title: "noStrictGenericChecks removed",
        reason: "`noStrictGenericChecks` is removed in TypeScript 7.0.",
        fix: "Remove `noStrictGenericChecks` and fix any generic variance errors it was masking."
      },
      {
        id: "charset",
        key: "charset",
        test: (o) => o.charset != null ? o.charset : null,
        title: "charset removed",
        reason: "`charset` has been a no-op since TypeScript 1.8 and is removed in TypeScript 7.0.",
        fix: "Remove `charset` (source files are read as UTF-8)."
      }
    ];
    var ADVISORY_RULES = [
      {
        id: "strict-default",
        key: "strict",
        applies: ({ options, optionsSet }) => !optionsSet.has("strict") || options.strict === false,
        title: "strict is now on by default",
        reason: "TypeScript 7.0 enables `strict` by default. Your tsconfig does not enable it, so the upgrade will turn on all strict-family checks at once \u2014 expect new type errors (nulls, implicit any, etc.).",
        fix: 'Set `"strict": true` now and fix the errors incrementally before upgrading, rather than all at once on the jump to 7.0.'
      },
      {
        id: "emit-decorator-metadata",
        key: "emitDecoratorMetadata",
        applies: ({ options }) => options.emitDecoratorMetadata === true,
        title: "emitDecoratorMetadata support on tsgo is unconfirmed",
        reason: "You rely on `emitDecoratorMetadata` (reflect-metadata DI \u2014 NestJS, TypeORM, Angular, class-transformer). The native Go compiler's design-time metadata emit is still unresolved upstream (typescript-go#741); do not assume runtime parity on 7.0.",
        fix: "Verify your DI/ORM works against the native compiler before upgrading; keep `typescript` on 6.x for the metadata-emitting build until parity is confirmed.",
        helpUri: DECORATORS_URI
      },
      {
        id: "implicit-types-inclusion",
        key: "types",
        applies: ({ optionsSet, deps }) => !optionsSet.has("types") && Object.keys(deps || {}).some((d) => d.startsWith("@types/")),
        title: 'no explicit "types" \u2014 @types packages may not be included on 7.0',
        reason: "You depend on @types/* packages but your tsconfig has no `types` field, so inclusion relies on TypeScript scanning node_modules/@types automatically. On the native compiler that did not happen in practice: a project with @types/node and no `types` field failed to build with TS2591 \"Cannot find name 'process'\" and TS2584 \"Cannot find name 'console'\" \u2014 tsgo's own error text tells you to add 'node' to the types field.",
        fix: 'Add an explicit `"types": ["node", \u2026]` listing the @types packages this project actually needs. It is a no-op on TypeScript 5/6 \u2014 it pins what was already being inferred \u2014 and it unblocks the 7.0 upgrade.'
      },
      {
        id: "ignore-deprecations",
        key: "ignoreDeprecations",
        applies: ({ optionsSet }) => optionsSet.has("ignoreDeprecations"),
        title: "ignoreDeprecations no longer rescues removed options",
        reason: "`ignoreDeprecations` silenced these options in TypeScript 6.x. In 7.0 the options are *removed*, not deprecated, so the escape hatch stops working and any options it was covering become hard errors.",
        fix: "Remove `ignoreDeprecations` and migrate the options it was suppressing (see the other tsconfig findings)."
      }
    ];
    var DECORATOR_FRAMEWORKS = [
      "@nestjs/core",
      "@nestjs/common",
      "typeorm",
      "@mikro-orm/core",
      "class-transformer",
      "class-validator",
      "reflect-metadata",
      "@angular/core"
    ];
    function stripComments(text) {
      let out = "";
      let i = 0;
      const n = text.length;
      let inStr = false;
      let quote = "";
      let inLine = false;
      let inBlock = false;
      while (i < n) {
        const c = text[i];
        const next = i + 1 < n ? text[i + 1] : "";
        if (inLine) {
          if (c === "\n") {
            inLine = false;
            out += c;
          }
          i++;
          continue;
        }
        if (inBlock) {
          if (c === "*" && next === "/") {
            inBlock = false;
            i += 2;
          } else {
            if (c === "\n") out += c;
            i++;
          }
          continue;
        }
        if (inStr) {
          out += c;
          if (c === "\\") {
            out += next;
            i += 2;
            continue;
          }
          if (c === quote) inStr = false;
          i++;
          continue;
        }
        if (c === '"' || c === "'") {
          inStr = true;
          quote = c;
          out += c;
          i++;
          continue;
        }
        if (c === "/" && next === "/") {
          inLine = true;
          i += 2;
          continue;
        }
        if (c === "/" && next === "*") {
          inBlock = true;
          i += 2;
          continue;
        }
        out += c;
        i++;
      }
      return out;
    }
    function removeTrailingCommas(text) {
      let out = "";
      let i = 0;
      const n = text.length;
      let inStr = false;
      let quote = "";
      while (i < n) {
        const c = text[i];
        if (inStr) {
          out += c;
          if (c === "\\") {
            out += i + 1 < n ? text[i + 1] : "";
            i += 2;
            continue;
          }
          if (c === quote) inStr = false;
          i++;
          continue;
        }
        if (c === '"' || c === "'") {
          inStr = true;
          quote = c;
          out += c;
          i++;
          continue;
        }
        if (c === ",") {
          let j = i + 1;
          while (j < n && /\s/.test(text[j])) j++;
          if (j < n && (text[j] === "}" || text[j] === "]")) {
            i++;
            continue;
          }
        }
        out += c;
        i++;
      }
      return out;
    }
    function parseJsonc(text) {
      return JSON.parse(removeTrailingCommas(stripComments(text)));
    }
    function locateKey(raw, key) {
      if (!raw || !key) return { line: 1, column: 1 };
      const needle = '"' + key + '"';
      const idx = raw.indexOf(needle);
      if (idx === -1) return { line: 1, column: 1 };
      let line = 1;
      let last = -1;
      for (let i = 0; i < idx; i++) {
        if (raw[i] === "\n") {
          line++;
          last = i;
        }
      }
      return { line, column: idx - last };
    }
    function findTsconfig(dir) {
      const p = path2.join(dir, "tsconfig.json");
      return fs2.existsSync(p) ? p : null;
    }
    function readTsconfig(tsconfigPath) {
      const seen = /* @__PURE__ */ new Set();
      const unresolvedExtends = [];
      let leafRaw = "";
      function load(p, depth) {
        if (depth > 8 || seen.has(p)) return { options: {}, references: [] };
        seen.add(p);
        let text;
        try {
          text = fs2.readFileSync(p, "utf8");
        } catch (e) {
          throw Object.assign(new Error(`Could not read ${p}: ${e.message}`), { code: "EREADTSCONFIG" });
        }
        if (depth === 0) leafRaw = text;
        let json;
        try {
          json = parseJsonc(text);
        } catch (e) {
          throw Object.assign(new Error(`Invalid JSON in ${p}: ${e.message}`), { code: "EBADTSCONFIG" });
        }
        let base = { options: {}, references: [] };
        const ext = json.extends;
        const extList = Array.isArray(ext) ? ext : ext != null ? [ext] : [];
        for (const e of extList) {
          if (typeof e === "string" && (e.startsWith("./") || e.startsWith("../") || e.startsWith("/"))) {
            let resolved = path2.resolve(path2.dirname(p), e);
            if (!/\.json$/i.test(resolved)) resolved += ".json";
            if (fs2.existsSync(resolved)) {
              const parent = load(resolved, depth + 1);
              base = { options: Object.assign({}, base.options, parent.options), references: parent.references };
            } else {
              unresolvedExtends.push(e);
            }
          } else if (e != null) {
            unresolvedExtends.push(String(e));
          }
        }
        const options = Object.assign({}, base.options, json.compilerOptions || {});
        const references = Array.isArray(json.references) ? json.references : base.references;
        return { options, references };
      }
      try {
        const { options, references } = load(tsconfigPath, 0);
        return { path: tsconfigPath, raw: leafRaw, options, references, unresolvedExtends, parseError: null };
      } catch (e) {
        return {
          path: tsconfigPath,
          raw: leafRaw,
          options: {},
          references: [],
          unresolvedExtends,
          parseError: e.message
        };
      }
    }
    function evaluateTsconfig(parsed, ctx = {}) {
      const ts7 = !!ctx.ts7;
      const options = parsed.options || {};
      const optionsSet = new Set(Object.keys(options));
      const findings = [];
      const advisories = [];
      const raw = parsed.raw || "";
      const rel = parsed.relPath || "tsconfig.json";
      for (const rule of REMOVED_OPTIONS) {
        const hit = rule.test(options);
        if (hit === null || hit === void 0) continue;
        const loc = locateKey(raw, rule.key);
        findings.push({
          category: "tsconfig",
          id: rule.id,
          option: rule.key,
          value: hit,
          title: rule.title,
          reason: rule.reason,
          fix: rule.fix,
          severity: ts7 ? "conflict" : "warning",
          file: rel,
          line: loc.line,
          column: loc.column,
          helpUri: HELP_URI
        });
      }
      if (Array.isArray(parsed.references) && parsed.references.some((r) => r && r.prepend)) {
        const loc = locateKey(raw, "prepend");
        findings.push({
          category: "tsconfig",
          id: "references-prepend",
          option: "references[].prepend",
          value: true,
          title: "project-reference prepend removed",
          reason: "`prepend` on project references (concatenated `outFile` output) is removed in TypeScript 7.0.",
          fix: "Drop `prepend` and concatenate build output with a bundler if needed.",
          severity: ts7 ? "conflict" : "warning",
          file: rel,
          line: loc.line,
          column: loc.column,
          helpUri: HELP_URI
        });
      }
      const deps = ctx.deps || {};
      for (const rule of ADVISORY_RULES) {
        if (!rule.applies({ options, optionsSet, deps })) continue;
        let reason = rule.reason;
        if (rule.id === "emit-decorator-metadata") {
          const present = DECORATOR_FRAMEWORKS.filter(
            (f) => Object.prototype.hasOwnProperty.call(deps, f)
          );
          if (present.length) {
            reason += ` Detected in your dependencies: ${present.join(", ")}.`;
          }
        }
        const loc = locateKey(raw, rule.key);
        advisories.push({
          category: "risk",
          id: rule.id,
          option: rule.key,
          title: rule.title,
          reason,
          fix: rule.fix,
          severity: "advisory",
          file: rel,
          line: loc.line,
          column: loc.column,
          helpUri: rule.helpUri || HELP_URI
        });
      }
      return { findings, advisories };
    }
    function analyzeTsconfigDir(dir, ctx = {}) {
      const tsconfigPath = findTsconfig(dir);
      if (!tsconfigPath) {
        return { present: false, path: null, absPath: null, findings: [], advisories: [], parseError: null, unresolvedExtends: [] };
      }
      const parsed = readTsconfig(tsconfigPath);
      const root = ctx.root || dir;
      parsed.relPath = toPosix(path2.relative(root, tsconfigPath)) || "tsconfig.json";
      if (parsed.parseError) {
        return {
          present: true,
          path: parsed.relPath,
          absPath: tsconfigPath,
          findings: [],
          advisories: [],
          parseError: parsed.parseError,
          unresolvedExtends: parsed.unresolvedExtends
        };
      }
      const { findings, advisories } = evaluateTsconfig(parsed, ctx);
      return {
        present: true,
        path: parsed.relPath,
        absPath: tsconfigPath,
        findings,
        advisories,
        parseError: null,
        unresolvedExtends: parsed.unresolvedExtends
      };
    }
    function toPosix(p) {
      return p.split(path2.sep).join("/");
    }
    module2.exports = {
      REMOVED_OPTIONS,
      ADVISORY_RULES,
      DECORATOR_FRAMEWORKS,
      stripComments,
      removeTrailingCommas,
      parseJsonc,
      locateKey,
      findTsconfig,
      readTsconfig,
      evaluateTsconfig,
      analyzeTsconfigDir,
      HELP_URI,
      DECORATORS_URI
    };
  }
});

// src/core.js
var require_core = __commonJS({
  "src/core.js"(exports2, module2) {
    "use strict";
    var fs2 = require("node:fs");
    var path2 = require("node:path");
    var semver = require_semver2();
    var builtinDb = require_db();
    var tsconfig = require_tsconfig();
    var DEP_FIELDS = [
      "dependencies",
      "devDependencies",
      "optionalDependencies",
      "peerDependencies"
    ];
    function analyzeTypescriptVersion(raw) {
      if (raw == null) return { ts7: false, resolved: null, raw: null, satisfiable: false };
      let spec = String(raw).trim();
      const npmAlias = spec.match(/^npm:(?:@?[^@]+)@(.+)$/);
      if (npmAlias) spec = npmAlias[1].trim();
      spec = spec.replace(/^workspace:/, "").trim();
      if (spec === "" || spec === "*") {
        return { ts7: false, resolved: null, raw: String(raw), satisfiable: false };
      }
      let min = null;
      try {
        min = semver.minVersion(spec);
      } catch (_) {
        min = null;
      }
      if (!min) {
        const coerced = semver.coerce(spec);
        if (coerced) min = coerced;
      }
      if (!min) {
        return { ts7: false, resolved: null, raw: String(raw), satisfiable: false };
      }
      const resolved = min.version;
      const ts7 = semver.satisfies(resolved, ">=7.0.0", { includePrerelease: true }) || min.major >= 7;
      return { ts7, resolved, raw: String(raw), satisfiable: true };
    }
    function readOverrideTypescript(pkg) {
      const sources = [
        ["overrides", pkg.overrides],
        ["resolutions", pkg.resolutions],
        ["pnpm.overrides", pkg.pnpm && pkg.pnpm.overrides]
      ];
      for (const [name, obj] of sources) {
        if (obj && typeof obj === "object" && typeof obj.typescript === "string") {
          return { raw: obj.typescript, source: name };
        }
      }
      return null;
    }
    function getTypescriptSpec(pkg) {
      const override = readOverrideTypescript(pkg);
      if (override) return override;
      for (const field of DEP_FIELDS) {
        const deps = pkg[field];
        if (deps && typeof deps === "object" && typeof deps.typescript === "string") {
          return { raw: deps.typescript, source: field };
        }
      }
      return { raw: null, source: null };
    }
    function mergeDeps(pkg) {
      return Object.assign(
        {},
        pkg.peerDependencies || {},
        pkg.optionalDependencies || {},
        pkg.devDependencies || {},
        pkg.dependencies || {}
      );
    }
    function readPackageJson(dir) {
      const pkgPath = path2.join(dir, "package.json");
      if (!fs2.existsSync(pkgPath)) {
        const err = new Error(`No package.json found in ${path2.resolve(dir)}`);
        err.code = "ENOPKG";
        throw err;
      }
      let text;
      try {
        text = fs2.readFileSync(pkgPath, "utf8");
      } catch (e) {
        const err = new Error(`Could not read ${pkgPath}: ${e.message}`);
        err.code = "EREADPKG";
        throw err;
      }
      try {
        return { pkg: JSON.parse(text), pkgPath };
      } catch (e) {
        const err = new Error(`Invalid JSON in ${pkgPath}: ${e.message}`);
        err.code = "EBADPKG";
        throw err;
      }
    }
    function loadConfig(dir) {
      const cfgPath = path2.join(dir, ".ts7guardrc.json");
      if (!fs2.existsSync(cfgPath)) return {};
      let cfg;
      try {
        cfg = JSON.parse(fs2.readFileSync(cfgPath, "utf8"));
      } catch (e) {
        const err = new Error(`Invalid JSON in ${cfgPath}: ${e.message}`);
        err.code = "EBADCONFIG";
        throw err;
      }
      if (cfg == null || typeof cfg !== "object" || Array.isArray(cfg)) {
        const err = new Error(`${cfgPath} must contain a JSON object`);
        err.code = "EBADCONFIG";
        throw err;
      }
      return cfg;
    }
    function analyze(pkg, opts = {}) {
      const database = opts.extraDb ? Object.assign({}, opts.db || builtinDb, opts.extraDb) : opts.db || builtinDb;
      const ignore = new Set(opts.ignore || []);
      const deps = mergeDeps(pkg);
      const tsSpec = getTypescriptSpec(pkg);
      const tsInfo = analyzeTypescriptVersion(tsSpec.raw);
      const conflicts = [];
      const ignored = [];
      for (const key of Object.keys(deps)) {
        if (key === "typescript") continue;
        if (!Object.prototype.hasOwnProperty.call(database, key)) continue;
        const entry = { pkg: key, version: String(deps[key]), reason: database[key].reason, fix: database[key].fix };
        if (ignore.has(key)) ignored.push(entry);
        else conflicts.push(entry);
      }
      conflicts.sort((a, b) => a.pkg.localeCompare(b.pkg));
      ignored.sort((a, b) => a.pkg.localeCompare(b.pkg));
      const result = {
        ts7: tsInfo.ts7,
        typescript: {
          raw: tsInfo.raw,
          resolved: tsInfo.resolved,
          satisfiable: tsInfo.satisfiable,
          source: tsSpec.source
        },
        conflicts,
        ignored,
        name: pkg.name,
        tsconfig: { present: false, path: null, absPath: null, findings: [], parseError: null, unresolvedExtends: [] },
        risks: []
      };
      return finalize(result);
    }
    function finalize(result) {
      const tsFindings = result.tsconfig && result.tsconfig.findings || [];
      const activeDep = result.ts7 ? result.conflicts.length : 0;
      const activeTsconfig = tsFindings.filter((f) => f.severity === "conflict").length;
      result.activeConflictCount = activeDep + activeTsconfig;
      result.hasActiveConflict = result.activeConflictCount > 0;
      result.warningCount = (result.ts7 ? 0 : result.conflicts.length) + tsFindings.filter((f) => f.severity === "warning").length;
      result.advisoryCount = (result.risks || []).length;
      return result;
    }
    function analyzeDir(dir, opts = {}) {
      const { pkg, pkgPath } = readPackageJson(dir);
      const result = analyze(pkg, opts);
      result.pkgPath = pkgPath;
      result.dir = dir;
      if (opts.tsconfig !== false) {
        const deps = mergeDeps(pkg);
        const ts = tsconfig.analyzeTsconfigDir(dir, { ts7: result.ts7, deps, root: dir });
        result.tsconfig = {
          present: ts.present,
          path: ts.path,
          absPath: ts.absPath,
          findings: ts.findings,
          parseError: ts.parseError,
          unresolvedExtends: ts.unresolvedExtends
        };
        result.risks = ts.advisories || [];
      }
      return finalize(result);
    }
    var DEFAULT_SKIP_DIRS = /* @__PURE__ */ new Set([
      "node_modules",
      ".git",
      ".hg",
      ".svn",
      "bower_components",
      ".yarn",
      "dist",
      "build",
      "out",
      "coverage",
      ".next",
      ".nuxt",
      ".svelte-kit"
    ]);
    function findPackageDirs(root, opts = {}) {
      const maxDepth = opts.maxDepth == null ? 8 : opts.maxDepth;
      const skip = opts.skip || DEFAULT_SKIP_DIRS;
      const found = [];
      function walk(dir, depth) {
        let entries;
        try {
          entries = fs2.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
          return;
        }
        if (entries.some((e) => e.isFile() && e.name === "package.json")) {
          found.push(dir);
        }
        if (depth >= maxDepth) return;
        const subdirs = entries.filter((e) => e.isDirectory() && !skip.has(e.name) && !e.name.startsWith(".")).map((e) => e.name).sort();
        for (const name of subdirs) {
          walk(path2.join(dir, name), depth + 1);
        }
      }
      walk(root, 0);
      found.sort();
      return found;
    }
    function analyzeMany(dirs, opts = {}) {
      const results = [];
      for (const dir of dirs) {
        try {
          results.push(analyzeDir(dir, opts));
        } catch (e) {
          results.push({ dir, error: e.message, conflicts: [], ignored: [], ts7: false });
        }
      }
      const tsFindings = (r) => r.tsconfig && r.tsconfig.findings || [];
      const summary = {
        packagesScanned: results.length,
        packagesWithConflicts: results.filter(
          (r) => r.conflicts && r.conflicts.length > 0 || tsFindings(r).length > 0
        ).length,
        activeConflictPackages: results.filter((r) => r.hasActiveConflict).length,
        totalConflicts: results.reduce((n, r) => n + (r.conflicts ? r.conflicts.length : 0), 0),
        totalTsconfigFindings: results.reduce((n, r) => n + tsFindings(r).length, 0),
        totalAdvisories: results.reduce((n, r) => n + (r.risks && r.risks.length || 0), 0),
        errors: results.filter((r) => r.error).length
      };
      return { results, summary };
    }
    function exitCodeFor(result, mode) {
      if (mode === "fail" && result.hasActiveConflict) return 1;
      return 0;
    }
    function exitCodeForMany(agg, mode) {
      if (mode === "fail" && agg.summary.activeConflictPackages > 0) return 1;
      return 0;
    }
    module2.exports = {
      db: builtinDb,
      builtinDb,
      tsconfig,
      analyze,
      analyzeDir,
      analyzeMany,
      finalize,
      analyzeTypescriptVersion,
      getTypescriptSpec,
      readOverrideTypescript,
      readPackageJson,
      loadConfig,
      mergeDeps,
      findPackageDirs,
      exitCodeFor,
      exitCodeForMany,
      DEFAULT_SKIP_DIRS
    };
  }
});

// src/report.js
var require_report = __commonJS({
  "src/report.js"(exports2, module2) {
    "use strict";
    var TITLE = "=== TypeScript 7.0 / tsgo Readiness ===";
    function statusOf(result) {
      if (result.hasActiveConflict) return "conflict";
      if (result.warningCount > 0) return "warning";
      if (result.advisoryCount > 0) return "advisory";
      return "clean";
    }
    function humanReport2(result, opts = {}) {
      const c = makeColors(!!opts.color);
      const lines = [];
      lines.push(c.bold(TITLE));
      const tsRaw = result.typescript.raw;
      const srcNote = result.typescript.source && result.typescript.source !== "dependencies" ? c.dim(` (via ${result.typescript.source})`) : "";
      if (tsRaw == null) {
        lines.push(c.dim("  typescript: not a direct dependency"));
      } else if (result.ts7) {
        lines.push("  " + c.red(`typescript ${tsRaw} \u2192 TypeScript 7.0 detected`) + srcNote);
      } else {
        lines.push("  " + c.green(`typescript ${tsRaw} \u2192 TypeScript 6.x (pre-7.0)`) + srcNote);
      }
      const tsFindings = result.tsconfig && result.tsconfig.findings || [];
      const risks = result.risks || [];
      const nothing = result.conflicts.length === 0 && tsFindings.length === 0 && risks.length === 0;
      if (result.tsconfig && result.tsconfig.parseError) {
        lines.push("  " + c.yellow(`tsconfig.json: could not parse (${result.tsconfig.parseError})`));
      }
      if (nothing) {
        lines.push("");
        lines.push(c.green("  \u2713 No TypeScript 7.0 / tsgo readiness issues found."));
        appendIgnored(lines, result, c);
        return lines;
      }
      if (result.conflicts.length > 0) {
        lines.push("");
        lines.push(c.bold("  [dependencies]"));
        if (result.ts7) {
          for (const conf of result.conflicts) {
            lines.push("  " + c.red(`CONFLICT: ${conf.pkg} \u2014 ${conf.reason}`));
            lines.push("    " + c.yellow(`Fix: ${conf.fix}`));
          }
        } else {
          for (const conf of result.conflicts) {
            lines.push(
              "  " + c.yellow(
                `WARNING: ${conf.pkg} will break when typescript is upgraded to ^7 \u2014 plan migration now.`
              )
            );
            lines.push("    " + c.dim(`Reason: ${conf.reason}`));
            lines.push("    " + c.dim(`Fix: ${conf.fix}`));
          }
        }
      }
      if (tsFindings.length > 0) {
        lines.push("");
        lines.push(c.bold("  [tsconfig.json]"));
        for (const f of tsFindings) {
          const loc = c.dim(` (${f.file}:${f.line})`);
          if (f.severity === "conflict") {
            lines.push("  " + c.red(`CONFLICT: ${f.option} \u2014 ${f.title}`) + loc);
          } else {
            lines.push("  " + c.yellow(`WARNING: ${f.option} \u2014 ${f.title} (breaks on upgrade to ^7)`) + loc);
          }
          lines.push("    " + c.dim(`Reason: ${f.reason}`));
          lines.push("    " + c.yellow(`Fix: ${f.fix}`));
        }
      }
      if (risks.length > 0) {
        lines.push("");
        lines.push(c.bold("  [advisories]") + c.dim("  (behavioural risks \u2014 do not fail the build)"));
        for (const r of risks) {
          const loc = r.file ? c.dim(` (${r.file}:${r.line})`) : "";
          lines.push("  " + c.cyan(`ADVISORY: ${r.title}`) + loc);
          lines.push("    " + c.dim(`${r.reason}`));
          lines.push("    " + c.dim(`Fix: ${r.fix}`));
        }
      }
      lines.push("");
      const parts = [];
      if (result.activeConflictCount > 0) parts.push(`${result.activeConflictCount} conflict(s)`);
      if (result.warningCount > 0) parts.push(`${result.warningCount} warning(s)`);
      if (result.advisoryCount > 0) parts.push(`${result.advisoryCount} advisory(ies)`);
      const summary = `  ${parts.join(" \xB7 ")}`;
      if (result.hasActiveConflict) {
        lines.push(c.red(summary + " \u2014 type-checking/builds will break under TypeScript 7.0."));
      } else if (result.warningCount > 0) {
        lines.push(
          c.yellow(summary + " \u2014 you are on TypeScript 6.x today, so nothing is broken yet.")
        );
      } else {
        lines.push(c.cyan(summary + " \u2014 no build-breaking issues; review advisories before upgrading."));
      }
      appendIgnored(lines, result, c);
      return lines;
    }
    function appendIgnored(lines, result, c) {
      if (result.ignored && result.ignored.length > 0) {
        lines.push("");
        lines.push(
          c.dim(`  Ignored (${result.ignored.length}): ${result.ignored.map((i) => i.pkg).join(", ")}`)
        );
      }
    }
    function humanReportMany2(agg, opts = {}) {
      const c = makeColors(!!opts.color);
      const path2 = require("node:path");
      const root = opts.root || process.cwd();
      const lines = [];
      lines.push(c.bold("=== TypeScript 7.0 / tsgo Readiness (recursive) ==="));
      lines.push(c.dim(`  scanned ${agg.summary.packagesScanned} package(s) under ${root}`));
      lines.push("");
      for (const r of agg.results) {
        const rel = toPosix(path2.relative(root, r.dir)) || ".";
        if (r.error) {
          lines.push("  " + c.red(`\u2717 ${rel}: ${r.error}`));
          continue;
        }
        const tsFindings = r.tsconfig && r.tsconfig.findings || [];
        const risks = r.risks || [];
        if (r.hasActiveConflict) {
          lines.push("  " + c.red(`\u25CF ${rel}`) + c.dim(`  (typescript ${r.typescript.raw})`));
          if (r.ts7) {
            for (const conf of r.conflicts) {
              lines.push("      " + c.red(`CONFLICT: ${conf.pkg} \u2014 ${conf.reason}`));
              lines.push("        " + c.yellow(`Fix: ${conf.fix}`));
            }
          }
          for (const f of tsFindings.filter((x) => x.severity === "conflict")) {
            lines.push("      " + c.red(`CONFLICT: ${f.option} \u2014 ${f.title}`) + c.dim(` (${f.file}:${f.line})`));
            lines.push("        " + c.yellow(`Fix: ${f.fix}`));
          }
        } else if (r.warningCount > 0) {
          lines.push("  " + c.yellow(`\u25CB ${rel}`) + c.dim(`  (typescript ${r.typescript.raw || "n/a"})`));
          for (const conf of r.conflicts) {
            lines.push(
              "      " + c.yellow(`WARNING: ${conf.pkg} will break when typescript is upgraded to ^7.`)
            );
          }
          for (const f of tsFindings.filter((x) => x.severity === "warning")) {
            lines.push("      " + c.yellow(`WARNING: ${f.option} \u2014 ${f.title} (breaks on upgrade).`));
          }
        } else if (risks.length > 0) {
          lines.push("  " + c.cyan(`\u25CD ${rel}`) + c.dim(`  (${risks.length} advisory(ies))`));
        } else {
          lines.push("  " + c.green(`\u2713 ${rel}`) + c.dim("  (clean)"));
        }
      }
      lines.push("");
      const s = agg.summary;
      const summaryLine = `  ${s.packagesScanned} scanned \xB7 ${s.activeConflictPackages} with active conflicts \xB7 ${s.packagesWithConflicts - s.activeConflictPackages} with warnings \xB7 ${s.totalAdvisories} advisory(ies) \xB7 ${s.errors} error(s)`;
      lines.push(s.activeConflictPackages > 0 ? c.red(summaryLine) : c.green(summaryLine));
      return lines;
    }
    function jsonReport2(result) {
      const tsFindings = result.tsconfig && result.tsconfig.findings || [];
      const risks = result.risks || [];
      return {
        tool: "ts7-compat-guard",
        ts7: result.ts7,
        typescript: result.typescript,
        status: statusOf(result),
        conflictCount: result.activeConflictCount,
        warningCount: result.warningCount,
        advisoryCount: result.advisoryCount,
        conflicts: result.conflicts.map((conf) => ({
          pkg: conf.pkg,
          version: conf.version,
          reason: conf.reason,
          fix: conf.fix,
          severity: result.ts7 ? "conflict" : "warning"
        })),
        tsconfig: {
          present: !!(result.tsconfig && result.tsconfig.present),
          path: result.tsconfig ? result.tsconfig.path : null,
          parseError: result.tsconfig ? result.tsconfig.parseError : null,
          findings: tsFindings.map((f) => ({
            id: f.id,
            option: f.option,
            value: f.value,
            title: f.title,
            reason: f.reason,
            fix: f.fix,
            severity: f.severity,
            file: f.file,
            line: f.line,
            column: f.column
          }))
        },
        advisories: risks.map((r) => ({
          id: r.id,
          option: r.option,
          title: r.title,
          reason: r.reason,
          fix: r.fix,
          file: r.file,
          line: r.line
        })),
        ignored: (result.ignored || []).map((i) => i.pkg)
      };
    }
    function jsonReportMany2(agg, opts = {}) {
      const path2 = require("node:path");
      const root = opts.root || process.cwd();
      return {
        tool: "ts7-compat-guard",
        mode: "recursive",
        root,
        summary: agg.summary,
        packages: agg.results.map((r) => {
          if (r.error) return { dir: toPosix(path2.relative(root, r.dir)) || ".", error: r.error };
          const single = jsonReport2(r);
          return Object.assign({ dir: toPosix(path2.relative(root, r.dir)) || "." }, single);
        })
      };
    }
    function toPosix(p) {
      return require("node:path").sep === "\\" ? p.split("\\").join("/") : p;
    }
    function makeColors(enabled) {
      if (!enabled) {
        const id = (s) => s;
        return { bold: id, dim: id, red: id, green: id, yellow: id, cyan: id };
      }
      const wrap = (open, close) => (s) => `[${open}m${s}[${close}m`;
      return {
        bold: wrap(1, 22),
        dim: wrap(2, 22),
        red: wrap(31, 39),
        green: wrap(32, 39),
        yellow: wrap(33, 39),
        cyan: wrap(36, 39)
      };
    }
    module2.exports = { humanReport: humanReport2, humanReportMany: humanReportMany2, jsonReport: jsonReport2, jsonReportMany: jsonReportMany2, statusOf };
  }
});

// src/sarif.js
var require_sarif = __commonJS({
  "src/sarif.js"(exports2, module2) {
    "use strict";
    var path2 = require("node:path");
    var SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
    var VERSION = "2.1.0";
    var DEP_HELP = "https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/";
    function toPosix(p) {
      return p.split(path2.sep).join("/");
    }
    function sanitize(s) {
      return String(s).replace(/[^a-zA-Z0-9]/g, "_");
    }
    function buildSarif2(results, opts = {}) {
      const root = opts.root || process.cwd();
      const version = opts.version || "0.0.0";
      const rulesById = /* @__PURE__ */ new Map();
      const sarifResults = [];
      const ensureRule = (rule) => {
        if (!rulesById.has(rule.id)) rulesById.set(rule.id, rule);
      };
      const location = (uri, line, column) => ({
        physicalLocation: {
          artifactLocation: { uri, uriBaseId: "%SRCROOT%" },
          region: { startLine: line || 1, startColumn: column || 1 }
        }
      });
      for (const r of results) {
        if (!r) continue;
        const pkgPath = r.pkgPath || path2.join(r.dir || root, "package.json");
        const pkgUri = toPosix(path2.relative(root, pkgPath)) || "package.json";
        for (const conf of r.conflicts || []) {
          const ruleId = `ts7-compat/dep/${conf.pkg}`;
          const level = r.ts7 ? "error" : "warning";
          ensureRule({
            id: ruleId,
            name: `TS7Dep_${sanitize(conf.pkg)}`,
            shortDescription: { text: `${conf.pkg} is incompatible with TypeScript 7.0` },
            fullDescription: { text: conf.reason },
            helpUri: DEP_HELP,
            help: { text: `Fix: ${conf.fix}` },
            defaultConfiguration: { level: "error" },
            properties: { tags: ["typescript", "typescript-7", "tsgo", "dependency"] }
          });
          sarifResults.push({
            ruleId,
            level,
            message: {
              text: r.ts7 ? `CONFLICT: ${conf.pkg} \u2014 ${conf.reason} Fix: ${conf.fix}` : `${conf.pkg} will break when typescript is upgraded to ^7 \u2014 plan migration now. Fix: ${conf.fix}`
            },
            locations: [location(pkgUri, 1, 1)],
            partialFingerprints: { ts7CompatGuard: `${pkgUri}::dep::${conf.pkg}` }
          });
        }
        const tsFindings = r.tsconfig && r.tsconfig.findings || [];
        const tsUri = r.tsconfig && r.tsconfig.absPath ? toPosix(path2.relative(root, r.tsconfig.absPath)) : toPosix(path2.relative(root, path2.join(r.dir || root, "tsconfig.json")));
        for (const f of tsFindings) {
          const ruleId = `ts7-compat/tsconfig/${f.id}`;
          ensureRule({
            id: ruleId,
            name: `TS7Tsconfig_${sanitize(f.id)}`,
            shortDescription: { text: f.title },
            fullDescription: { text: f.reason },
            helpUri: f.helpUri || DEP_HELP,
            help: { text: `Fix: ${f.fix}` },
            defaultConfiguration: { level: "error" },
            properties: { tags: ["typescript", "typescript-7", "tsgo", "tsconfig"] }
          });
          sarifResults.push({
            ruleId,
            level: f.severity === "conflict" ? "error" : "warning",
            message: { text: `${f.option}: ${f.title}. ${f.reason} Fix: ${f.fix}` },
            locations: [location(tsUri, f.line, f.column)],
            partialFingerprints: { ts7CompatGuard: `${tsUri}::tsconfig::${f.id}` }
          });
        }
        for (const a of r.risks || []) {
          const ruleId = `ts7-compat/risk/${a.id}`;
          ensureRule({
            id: ruleId,
            name: `TS7Risk_${sanitize(a.id)}`,
            shortDescription: { text: a.title },
            fullDescription: { text: a.reason },
            helpUri: a.helpUri || DEP_HELP,
            help: { text: `Fix: ${a.fix}` },
            defaultConfiguration: { level: "note" },
            properties: { tags: ["typescript", "typescript-7", "tsgo", "advisory"] }
          });
          sarifResults.push({
            ruleId,
            level: "note",
            message: { text: `${a.title}. ${a.reason} Fix: ${a.fix}` },
            locations: [location(tsUri, a.line, a.column)],
            partialFingerprints: { ts7CompatGuard: `${tsUri}::risk::${a.id}` }
          });
        }
      }
      return {
        $schema: SARIF_SCHEMA,
        version: VERSION,
        runs: [
          {
            tool: {
              driver: {
                name: "ts7-compat-guard",
                informationUri: "https://www.npmjs.com/package/ts7-compat-guard",
                version,
                rules: Array.from(rulesById.values())
              }
            },
            originalUriBaseIds: {
              "%SRCROOT%": { uri: toPosix(root.endsWith(path2.sep) ? root : root + path2.sep) }
            },
            results: sarifResults
          }
        ]
      };
    }
    module2.exports = { buildSarif: buildSarif2, SARIF_SCHEMA };
  }
});

// src/action.js
var path = require("node:path");
var fs = require("node:fs");
var core = require_core();
var { humanReport, humanReportMany, jsonReport, jsonReportMany } = require_report();
var { buildSarif } = require_sarif();
function getInput(name, fallback) {
  const keys = ["INPUT_" + name.toUpperCase(), "INPUT_" + name.toUpperCase().replace(/-/g, "_")];
  for (const key of keys) {
    const v = process.env[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return fallback;
}
function getBoolInput(name, fallback) {
  const v = getInput(name, null);
  if (v == null) return fallback;
  return /^(true|1|yes|on)$/i.test(v);
}
function escapeData(s) {
  return String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
function emit(cmd, message) {
  process.stdout.write(`::${cmd}::${escapeData(message)}
`);
}
function setOutput(name, value) {
  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    const delim = `ghadelimiter_${name}_${Buffer.byteLength(String(value))}`;
    fs.appendFileSync(file, `${name}<<${delim}
${value}
${delim}
`);
  } else {
    process.stdout.write(`::set-output name=${name}::${escapeData(value)}
`);
  }
}
function appendSummary(md) {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) {
    try {
      fs.appendFileSync(file, md + "\n");
    } catch (_) {
    }
  }
}
function annotateConflicts(result) {
  for (const conf of result.conflicts) {
    if (result.ts7) {
      emit("error", `CONFLICT: ${conf.pkg} \u2014 ${conf.reason} Fix: ${conf.fix}`);
    } else {
      emit(
        "warning",
        `${conf.pkg} will break when typescript is upgraded to ^7 \u2014 plan migration now. Fix: ${conf.fix}`
      );
    }
  }
  const tsFindings = result.tsconfig && result.tsconfig.findings || [];
  const tsFile = result.tsconfig && result.tsconfig.absPath ? path.relative(process.cwd(), result.tsconfig.absPath).split(path.sep).join("/") : result.tsconfig && result.tsconfig.path;
  for (const f of tsFindings) {
    const loc = tsFile ? `file=${tsFile},line=${f.line},col=${f.column}` : "";
    const cmd = f.severity === "conflict" ? "error" : "warning";
    const prefix = f.severity === "conflict" ? "CONFLICT" : "WARNING";
    emit(
      loc ? `${cmd} ${loc}` : cmd,
      `${prefix}: tsconfig ${f.option} \u2014 ${f.reason} Fix: ${f.fix}`
    );
  }
  for (const a of result.risks || []) {
    const loc = tsFile ? `file=${tsFile},line=${a.line},col=${a.column}` : "";
    emit(loc ? `notice ${loc}` : "notice", `ADVISORY: ${a.title} \u2014 ${a.reason} Fix: ${a.fix}`);
  }
}
function main() {
  const dirInput = getInput("package-dir", ".");
  const mode = getInput("mode", "fail");
  const recursive = getBoolInput("recursive", false);
  const sarifFile = getInput("sarif-file", null);
  const ignoreInput = getInput("ignore", "");
  const useConfig = getBoolInput("config", true);
  const resolvedDir = path.resolve(process.cwd(), dirInput);
  let config = {};
  try {
    if (useConfig) config = core.loadConfig(resolvedDir);
  } catch (e) {
    emit("error", `ts7-compat-guard: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const ignore = [].concat(Array.isArray(config.ignore) ? config.ignore : []).concat(
    String(ignoreInput).split(",").map((s) => s.trim()).filter(Boolean)
  );
  const extraDb = config.db && typeof config.db === "object" ? config.db : {};
  const effectiveMode = mode === "warn" || mode === "fail" ? mode : config.mode || "fail";
  const analyzeOpts = { extraDb, ignore };
  const version = safeVersion();
  if (recursive) {
    let dirs;
    try {
      dirs = core.findPackageDirs(resolvedDir);
    } catch (e) {
      emit("error", `ts7-compat-guard: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    if (dirs.length === 0) {
      emit("error", `ts7-compat-guard: no package.json found under ${resolvedDir}`);
      process.exitCode = 1;
      return;
    }
    const agg = core.analyzeMany(dirs, analyzeOpts);
    process.stdout.write(humanReportMany(agg, { color: false, root: resolvedDir }).join("\n") + "\n");
    for (const r of agg.results) {
      if (r.conflicts) annotateConflicts(r);
    }
    if (sarifFile) writeSarif(agg.results, resolvedDir, version, sarifFile);
    const json2 = jsonReportMany(agg, { root: resolvedDir });
    const activeCount = agg.results.reduce((n, r) => n + (r.activeConflictCount || 0), 0);
    setOutput("ts7", String(agg.results.some((r) => r.ts7)));
    setOutput("conflict-count", String(activeCount));
    setOutput("tsconfig-count", String(agg.summary.totalTsconfigFindings));
    setOutput("advisory-count", String(agg.summary.totalAdvisories));
    setOutput("status", agg.summary.activeConflictPackages > 0 ? "conflict" : agg.summary.packagesWithConflicts > 0 ? "warning" : agg.summary.totalAdvisories > 0 ? "advisory" : "clean");
    setOutput("json", JSON.stringify(json2));
    appendSummary(
      `### ts7-compat-guard

Scanned **${agg.summary.packagesScanned}** package(s): **${agg.summary.activeConflictPackages}** with active conflicts, **${agg.summary.packagesWithConflicts - agg.summary.activeConflictPackages}** with warnings, **${agg.summary.totalAdvisories}** advisory(ies).`
    );
    if (effectiveMode === "fail" && agg.summary.activeConflictPackages > 0) {
      emit("error", `ts7-compat-guard failed: ${agg.summary.activeConflictPackages} package(s) have active TypeScript 7.0 conflicts.`);
      process.exitCode = 1;
    } else {
      process.exitCode = 0;
    }
    return;
  }
  let result;
  try {
    result = core.analyzeDir(resolvedDir, analyzeOpts);
  } catch (e) {
    emit("error", `ts7-compat-guard: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(humanReport(result, { color: false }).join("\n") + "\n");
  const json = jsonReport(result);
  const tsCount = result.tsconfig && result.tsconfig.findings.length || 0;
  setOutput("ts7", String(result.ts7));
  setOutput("conflict-count", String(result.activeConflictCount));
  setOutput("tsconfig-count", String(tsCount));
  setOutput("advisory-count", String(result.advisoryCount));
  setOutput("status", json.status);
  setOutput("json", JSON.stringify(json));
  const anyFinding = result.conflicts.length > 0 || tsCount > 0 || result.advisoryCount > 0;
  if (anyFinding) annotateConflicts(result);
  else emit("notice", "ts7-compat-guard: no TypeScript 7.0 / tsgo readiness issues found.");
  if (sarifFile) writeSarif([result], resolvedDir, version, sarifFile);
  appendSummary(
    `### ts7-compat-guard

\`typescript\` ${result.typescript.raw || "n/a"} \u2192 ${result.ts7 ? "TypeScript 7.0 detected" : "TypeScript 6.x"} \xB7 **${result.activeConflictCount}** conflict(s), **${result.warningCount}** warning(s), **${result.advisoryCount}** advisory(ies) (status: ${json.status}).`
  );
  if (effectiveMode === "fail" && result.hasActiveConflict) {
    emit("error", `ts7-compat-guard failed: ${result.activeConflictCount} build-breaking TypeScript 7.0 conflict(s) detected.`);
    process.exitCode = 1;
  } else {
    process.exitCode = 0;
  }
}
function writeSarif(results, root, version, file) {
  try {
    const sarif = buildSarif(results, { root, version });
    const abs = path.resolve(process.cwd(), file);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(sarif, null, 2) + "\n");
    emit("notice", `ts7-compat-guard: SARIF written to ${file}`);
  } catch (e) {
    emit("warning", `ts7-compat-guard: could not write SARIF to ${file}: ${e.message}`);
  }
}
function safeVersion() {
  if (true) return "2.2.1";
  try {
    const fs2 = require("node:fs");
    const path2 = require("node:path");
    return JSON.parse(fs2.readFileSync(path2.join(__dirname, "..", "package.json"), "utf8")).version;
  } catch (_) {
    return "0.0.0";
  }
}
if (require.main === module) {
  main();
}
module.exports = { main, getInput, getBoolInput };
