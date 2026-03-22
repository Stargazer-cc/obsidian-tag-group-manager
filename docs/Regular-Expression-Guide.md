# Regular Expression Guide

## Table of Contents

- [What is Regular Expression](#what-is-regular-expression)
- [Use Cases in Plugin](#use-cases-in-plugin)
- [Basic Syntax](#basic-syntax)
- [Practical Examples](#practical-examples)
- [Advanced Techniques](#advanced-techniques)
- [FAQ](#faq)
- [Online Testing Tools](#online-testing-tools)

---

## What is Regular Expression

Regular Expression (Regex) is a powerful text pattern matching tool that can describe complex matching rules with concise syntax.

### Why Use Regular Expressions?

In Tag Group Manager, regular expressions help you:
- Batch match multiple similar tags
- Flexibly define tag matching rules
- Automate tag management workflows
- Handle complex tag naming patterns

---

## Use Cases in Plugin

### 1. Batch Color Settings

In the "Batch Color Operation" section, use regex to match multiple tags and set colors uniformly.

**Example**:
```
Regex: ^movie.*
Effect: Matches all tags starting with "movie" (movie, movies, movienight, etc.)
```

### 2. Rule-Based Auto-Add

In the "Auto-Add Tags to Groups" feature, use regex to define matching rules.

**Example**:
```
Rule: ^project/.*:Project Management
Effect: Adds all tags starting with "project/" to "Project Management" group
```

### 3. Tag Filtering

Use regex to quickly locate target tags in various tag selection and filtering scenarios.

---

## Basic Syntax

### Character Matching

| Syntax | Description | Example | Matches |
|--------|-------------|---------|---------|
| `.` | Matches any single character | `mov.` | move, movi, movs |
| `\d` | Matches any digit (0-9) | `\d+` | 123, 2023, 42 |
| `\w` | Matches letters, digits, or underscore | `\w+` | abc, test_123 |
| `\s` | Matches whitespace | `\s+` | space, multiple spaces |
| `[abc]` | Matches any character in brackets | `[mts]ove` | move, tove, sove |
| `[^abc]` | Matches any character not in brackets | `[^m]ove` | love, dove (not move) |
| `[a-z]` | Matches any character from a to z | `[a-z]+` | abc, test |
| `[0-9]` | Matches any digit from 0 to 9 | `[0-9]+` | 123, 2023 |

### Quantifiers

| Syntax | Description | Example | Matches |
|--------|-------------|---------|---------|
| `*` | Matches 0 or more times | `tech.*` | tech, technology, technical |
| `+` | Matches 1 or more times | `code+` | code, codee |
| `?` | Matches 0 or 1 time | `books?` | book, books |
| `{n}` | Matches exactly n times | `\d{4}` | 2023, 1999 |
| `{n,}` | Matches at least n times | `\d{2,}` | 23, 123, 2023 |
| `{n,m}` | Matches between n and m times | `\d{2,4}` | 23, 123, 2023 |

### Position Anchors

| Syntax | Description | Example | Matches |
|--------|-------------|---------|---------|
| `^` | Matches start of string | `^movie` | movie (not "watch movie") |
| `$` | Matches end of string | `note$` | book note (not "notebook") |
| `\b` | Matches word boundary | `\bmovie\b` | "movie" (not "movies") |

### Logical Operators

| Syntax | Description | Example | Matches |
|--------|-------------|---------|---------|
| `\|` | OR operator | `movie\|film` | movie OR film |
| `()` | Grouping | `(movie\|film)s` | movies, films |

### Special Character Escaping

To match special characters literally, use backslash `\` to escape:

| Special Char | Escaped | Example |
|-------------|---------|---------|
| `.` | `\.` | `file\.txt` matches "file.txt" |
| `*` | `\*` | `important\*` matches "important*" |
| `+` | `\+` | `C\+\+` matches "C++" |
| `?` | `\?` | `what\?` matches "what?" |
| `^` | `\^` | `\^symbol` matches "^symbol" |
| `$` | `\$` | `\$100` matches "$100" |
| `\` | `\\` | `path\\file` matches "path\file" |
| `\|` | `\\\|` | `A\\\|B` matches "A\|B" |
| `()` | `\(\)` | `\(note\)` matches "(note)" |
| `[]` | `\[\]` | `\[tag\]` matches "[tag]" |
| `/` | `\/` | `path\/file` matches "path/file" |

---

## Practical Examples

### Basic Matching

#### Example 1: Match all tags starting with "work"

```
Regex: ^work.*
Matches: work, working, workplace, workflow
Doesn't match: homework, teamwork
```

#### Example 2: Match all tags containing "note"

```
Regex: .*note.*
Matches: note, notebook, meeting-note, note-taking
Doesn't match: record, memo
```

#### Example 3: Exact match "movie" or "film"

```
Regex: ^(movie|film)$
Matches: movie, film
Doesn't match: movies, films, movie-night
```

### Numbers and Dates

#### Example 4: Match all numeric tags

```
Regex: ^\d+$
Matches: 2023, 001, 42, 12345
Doesn't match: year2023, no001, item42
```

#### Example 5: Match tags containing years

```
Regex: .*20\d{2}.*
Matches: 2020, movie2023, 2021-01-01
Doesn't match: 1999, 2030 (because it's 20xx format)
```

#### Example 6: Match date format tags

```
Regex: ^\d{4}-\d{2}-\d{2}$
Matches: 2023-12-25, 2024-01-01
Doesn't match: 2023/12/25, 20231225
```

### Multi-Level Tags

#### Example 7: Match all multi-level tags

```
Regex: .*/.*
Matches: work/project, study/programming, life/health
Doesn't match: work, study, life (single-level tags)
```

#### Example 8: Match multi-level tags with specific prefix

```
Regex: ^work/.*
Matches: work/project, work/meeting, work/document
Doesn't match: personal/work, study/work-skills
```

#### Example 9: Match tags with 3+ levels

```
Regex: .*/.*/.+
Matches: frontend/framework/React, backend/language/Python
Doesn't match: frontend/framework, backend (less than 3 levels)
```

### Category Matching

#### Example 10: Match multiple specific prefixes

```
Regex: ^(work|study|life)
Matches: work, work/project, study-note, life-record
Doesn't match: entertainment, other
```

#### Example 11: Match specific suffixes

```
Regex: .*(note|record|summary)$
Matches: book-note, work-record, study-summary
Doesn't match: notebook, recording
```

#### Example 12: Match tags with specific keywords

```
Regex: .*(important|urgent|todo).*
Matches: important-task, urgent-meeting, todo-list, important-and-urgent
Doesn't match: normal-task, completed
```

### Complex Patterns

#### Example 13: Match programming language tags

```
Regex: ^(JavaScript|Python|Java|C\+\+|Go|Rust)$
Matches: JavaScript, Python, Java, C++, Go, Rust
Doesn't match: TypeScript, C#, Ruby
```

#### Example 14: Match project number format

```
Regex: ^PRJ-\d{4}$
Matches: PRJ-0001, PRJ-2023
Doesn't match: PRJ-01, project-0001
```

#### Example 15: Match version number format

```
Regex: ^v\d+\.\d+\.\d+$
Matches: v1.0.0, v2.3.5, v10.20.30
Doesn't match: v1.0, 1.0.0, version1.0.0
```

---

## Advanced Techniques

### 1. Non-Greedy Matching

By default, `*`, `+`, `?` are greedy. Add `?` to make them non-greedy.

```
Greedy: .*tag
Text: "this is tag1 and tag2"
Matches: "this is tag1 and tag" (matches to last "tag")

Non-greedy: .*?tag
Text: "this is tag1 and tag2"
Matches: "this is tag" (matches to first "tag")
```

### 2. Lookahead and Lookbehind

#### Positive Lookahead `(?=...)`

Matches position followed by specific pattern.

```
Regex: work(?=/project)
Matches: "work" in "work/project"
Doesn't match: "work" in "work/meeting"
```

#### Negative Lookahead `(?!...)`

Matches position not followed by specific pattern.

```
Regex: work(?!/project)
Matches: "work" in "work/meeting"
Doesn't match: "work" in "work/project"
```

### 3. Capture Groups

Use parentheses `()` to create capture groups.

```
Regex: ^(\w+)/(\w+)$
Text: "frontend/React"
Group 1: "frontend"
Group 2: "React"
```

### 4. Named Capture Groups

Use `(?<name>...)` to name capture groups.

```
Regex: ^(?<category>\w+)/(?<item>\w+)$
Text: "frontend/React"
Group category: "frontend"
Group item: "React"
```

---

## FAQ

### Q1: Why doesn't my regex work?

**Possible reasons**:
1. Special characters not escaped
2. Syntax error
3. Case sensitivity mismatch

**Solutions**:
1. Check if special characters need escaping (`.`, `*`, `+`, etc.)
2. Test regex using online tools
3. Note that regex is case-sensitive by default

### Q2: How to match tags with slashes?

Slash `/` is common in multi-level tags and needs escaping:

```
Wrong: ^work/project$
Correct: ^work\/project$
```

### Q3: How to ignore case?

In the plugin, regex is case-insensitive by default. If you need case-sensitive matching, specify it explicitly in the rule.

### Q4: How to match Chinese characters?

Chinese characters can be used directly without special handling:

```
Regex: ^中文.*
Matches: 中文标签, 中文笔记
```

### Q5: How to test my regex?

Use online tools:
- [Regex101](https://regex101.com/) - Powerful with detailed explanations
- [RegExr](https://regexr.com/) - User-friendly with real-time testing
- [RegexTester](https://www.regextester.com/) - Simple and intuitive

---

## Online Testing Tools

### Recommended Tools

1. **Regex101** (https://regex101.com/)
   - Most powerful features
   - Detailed match explanations
   - Supports multiple regex flavors
   - Can save and share regex

2. **RegExr** (https://regexr.com/)
   - User-friendly interface
   - Real-time testing
   - Syntax reference
   - Community regex library

3. **RegexTester** (https://www.regextester.com/)
   - Simple and intuitive
   - Quick testing
   - Suitable for beginners

### Usage Tips

1. Validate in testing tools before applying to plugin
2. Prepare test cases to ensure matches meet expectations
3. Test edge cases (empty strings, special characters, etc.)
4. Save commonly used regex patterns for reuse

---

## Quick Reference Card

### Common Patterns

```
Match anything: .*
Match start: ^pattern
Match end: pattern$
Exact match: ^pattern$
Contains: .*pattern.*
Multiple options: (option1|option2|option3)
Numbers: \d+ or [0-9]+
Letters: [a-zA-Z]+
Multi-level tags: .*/.*
```

### Escape Characters

```
Characters needing escape: . * + ? ^ $ \ | ( ) [ ] { } /
Escape method: Add backslash \ before character
Example: \. \* \+ \? \^ \$ \\ \| \( \) \[ \] \{ \} \/
```

---

## Summary

Regular expressions are powerful tools. After mastering basic syntax, you can greatly improve tag management efficiency. Recommendations:

1. Start with simple patterns, gradually learn complex syntax
2. Use online tools for testing and validation
3. Save commonly used regex patterns
4. Practice and improve through actual use

If you encounter problems:
- Refer to examples in this document
- Use online testing tools for debugging
- Seek help in the community

Happy tagging! 🎉
