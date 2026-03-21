# Multi-Level Tag Adaptation Guide

## Table of Contents

- [Overview](#overview)
- [Auto-Expand Multi-Level Tags](#auto-expand-multi-level-tags)
- [Rule-Based Auto-Add](#rule-based-auto-add)
- [Smart Matching Auto-Add](#smart-matching-auto-add)
- [Complete Workflow](#complete-workflow)
- [Best Practices](#best-practices)

---

## Overview

The Multi-Level Tag Adaptation feature helps users better manage and organize multi-level tags in Obsidian (e.g., `#frontend/framework/React`). It consists of three core modules:

1. **Auto-Expand Multi-Level Tags**: Converts multi-level tags into hierarchical structures of tag group sets and tag groups
2. **Rule-Based Auto-Add**: Automatically adds tags to specified tag groups based on keywords or regex patterns
3. **Smart Matching Auto-Add**: Automatically matches new tags to corresponding tag groups based on expand depth

---

## Auto-Expand Multi-Level Tags

### Feature Description

Automatically scans multi-level tags in your vault and creates corresponding tag group sets and tag group structures based on the configured expand depth.

### Expand Depth

#### 2-Level Expand

**Structure**: Tag Group / Tags

**Example**:
```
Original tags: #frontend/framework/React, #frontend/tools/Webpack, #backend/language/Python

After expansion:
├─ Tag Group: frontend
│  ├─ frontend/framework/React
│  ├─ frontend/tools/Webpack
│
└─ Tag Group: backend
   └─ backend/language/Python
```

**Use Case**: Domain/project-based classification, suitable for flat organizational structures

#### 3-Level Expand

**Structure**: Group Set (Level 1) / Tag Group (Level 2) / Tags

**Example**:
```
Original tags: #frontend/framework/React, #frontend/tools/Webpack, #backend/language/Python

After expansion:
├─ Group Set: frontend
│  ├─ Tag Group: framework
│  │  └─ frontend/framework/React
│  │
│  └─ Tag Group: tools
│     └─ frontend/tools/Webpack
│
└─ Group Set: backend
   └─ Tag Group: language
      └─ backend/language/Python
```

**Use Case**: Function/category-based classification, suitable for hierarchical organizational structures

### Configuration Options

#### Expand Depth
- **2-Level Expand**: Creates tag groups without group sets
- **3-Level Expand**: Creates both group sets and tag groups

#### Specify First-Level Tags
- Leave empty: Expand all multi-level tags
- Specify: Only expand specified first-level tags (comma-separated)
- Example: `frontend,backend,database`

### Usage Steps

1. Select expand depth in settings (2-level or 3-level)
2. (Optional) Specify first-level tags to expand
3. Click "Expand Now" button
4. System automatically creates tag group sets and tag group structures

### Notes

- Expansion creates new tag group sets and tag groups without deleting existing ones
- Existing tag groups won't be duplicated
- Expanded tags are marked as `autoExpandedTags` for intelligent management

---

## Rule-Based Auto-Add

### Feature Description

Automatically adds matching tags to specified tag groups based on user-defined rules (keywords or regex patterns).

### Rule Format

```
MatchPattern:TargetGroupName
```

**Examples**:
- `important:Important Items` - Adds tags containing "important" to "Important Items" group
- `^project/.*:Project Management` - Adds tags starting with "project/" to "Project Management" group
- `React:Frontend Frameworks` - Adds tags containing "React" to "Frontend Frameworks" group

### Matching Logic

1. **Regex First**: Attempts to match pattern as regex
2. **String Contains**: Falls back to case-insensitive string matching if regex fails
3. **Multi-Level Tag Handling**: 
   - For tags with 3+ levels, adds all nodes starting from the third level
   - For 2-level tags, adds the complete tag

### Configuration Options

#### Add Rules
- **Match Pattern**: Keyword or regex pattern
- **Target Group**: Tag group name to add to (supports autocomplete)

#### Run on Startup
- When enabled, automatically executes scan on plugin startup

### Usage Steps

1. Add rules in "Auto-Add Tags to Groups" section
2. Enter match pattern and target group name
3. Click "Add Rule" button
4. Click "Run Auto-Add Now" button to execute scan
5. (Optional) Enable "Run on Startup"

### Example Scenarios

#### Scenario 1: Classify by Importance
```
Rules: 
- important:Important Items
- urgent:Urgent Items
- todo:Todo Items

Results:
#important/ProjectA → Added to "Important Items" group
#urgent/Meeting → Added to "Urgent Items" group
#todo/Learning → Added to "Todo Items" group
```

#### Scenario 2: Classify by Project
```
Rules:
- ^work/.*:Work Projects
- ^personal/.*:Personal Projects
- ^learning/.*:Learning Projects

Results:
#work/ProjectA/Requirements → Added to "Work Projects" group
#personal/Blog/Writing → Added to "Personal Projects" group
#learning/Programming/Python → Added to "Learning Projects" group
```

---

## Smart Matching Auto-Add

### Feature Description

Works with the auto-expand feature to automatically match new multi-level tags to corresponding tag groups based on expand depth.

### Core Features

#### 1. Only Processes Unassigned Tags
- Only processes tags not yet added to any tag group
- Avoids duplicate additions and respects manual management
- Protects user's manual operations

#### 2. Auto-Selects Match Mode Based on Expand Depth
- **2-Level Expand** → **level1 mode** (match by first level)
- **3-Level Expand** → **level2 mode** (match by second level)
- Automatically updates match mode when expand depth changes

#### 3. No Match, No Add
- Not a priority concept, but **either-or**
- level1 mode: Only matches by first level, doesn't add if no match
- level2 mode: Only matches by second level, doesn't add if no match

### Match Mode Details

#### level1 Mode (For 2-Level Expand)

**How it works**: Only matches by the first level of multi-level tags

**Example**:
```
Tag: #frontend/framework/React
Match: Look for tag group named "frontend"

Result:
✅ If "frontend" group exists → Add to "frontend" group
❌ If "frontend" group doesn't exist → Don't add

Won't try:
❌ Won't try to match "framework" group (even if exists)
❌ Won't try to match any other groups
```

**Use Cases**:
- Domain classification: frontend, backend, DevOps
- Project classification: work, personal, learning
- Flat organizational structures

#### level2 Mode (For 3-Level Expand)

**How it works**: Only matches by the second level of multi-level tags

**Example**:
```
Tag: #frontend/framework/React
Match: Look for tag group named "framework"

Result:
✅ If "framework" group exists → Add to "framework" group
❌ If "framework" group doesn't exist → Don't add

Won't try:
❌ Won't try to match "frontend" group (even if exists)
❌ Won't try to match any other groups
```

**Use Cases**:
- Function classification: framework, language, tools
- Type classification: methodology, cases, tools
- Hierarchical organizational structures

### Relationship with Rule Matching

#### Execution Order

```
1. Check if tag is already in any tag group
   ↓ If not assigned
2. Try smart matching
   ↓ If smart matching succeeds
3. Skip rule matching
   ↓ If smart matching fails
4. Continue with rule matching
```

#### Complementary Usage

**Smart Matching**:
- Automatic hierarchical matching
- Suitable for regular multi-level tag structures
- Works with expand feature
- Executes first

**Rule Matching**:
- Based on keywords or regex
- Suitable for flexible custom rules
- Can handle tags that smart matching can't
- Executes after smart matching

**Example**:
```
Smart Matching (level2): #frontend/framework/Svelte → Added to "framework" group
Rule Matching: #important → Added to "Important Items" group (via rule: important:Important Items)
```

### Configuration Options

#### Enable Smart Matching
- Toggle to enable/disable the feature

#### Current Match Mode (Read-only)
- Displays current match mode
- Automatically set based on expand depth
- Includes example descriptions

### Usage Steps

1. First use "Auto-Expand Multi-Level Tags" to create tag group structure
2. Enable feature in "Smart Multi-level Tag Matching" section
3. System automatically sets match mode based on expand depth
4. New multi-level tags are automatically matched to corresponding groups
5. (Optional) Click "Run Auto-Add Now" button to manually execute scan

---

## Complete Workflow

### Initial Setup Flow

```
Step 1: Select Expand Depth
├─ 2-Level Expand: Domain/project classification
└─ 3-Level Expand: Function/category classification

Step 2: Execute Multi-Level Tag Expansion
├─ Click "Expand Now" button
├─ System creates tag group sets and tag groups
└─ Existing tags are automatically categorized

Step 3: Enable Smart Matching
├─ Turn on "Enable Smart Matching" toggle
├─ System automatically sets match mode
└─ New tags will be automatically categorized

Step 4: (Optional) Add Rule Matching
├─ Add custom matching rules
├─ Handle special tags
└─ Supplement smart matching
```

### Daily Usage Flow

```
Add New Tag
↓
Smart Matching Check
├─ Tag already in group? → Skip
├─ Found matching group? → Add to that group
└─ No match found? → Continue to rule matching
    ↓
    Rule Matching Check
    ├─ Matches rule? → Add to target group
    └─ No match? → Remain uncategorized
```

---

## Best Practices

### 1. Plan Tag Hierarchy Structure

**2-Level Expand Suitable For**:
- Domain classification: frontend, backend, DevOps
- Project classification: work, personal, learning
- Flat organizational structures
- Scenarios with fewer tags

**3-Level Expand Suitable For**:
- Function classification: framework, language, tools
- Type classification: methodology, cases, tools
- Hierarchical organizational structures
- Scenarios with more tags

### 2. Use Three Features Appropriately

**Multi-Level Tag Expansion**:
- For initializing tag group structure
- One-time operation, doesn't need frequent execution
- Suitable for situations with many existing multi-level tags

**Smart Matching**:
- For daily automatic categorization
- Works with expand feature
- Suitable for regular multi-level tags

**Rule Matching**:
- For handling special tags
- Supplements smart matching
- Suitable for flexible custom needs

### 3. Keep Tag Group Names Concise

- Tag group names should be concise and clear
- Easy for smart matching to recognize
- Avoid special characters

### 4. Regularly Check Unmatched Tags

- Use rule matching to handle special tags
- Or manually add to appropriate tag groups
- Maintain completeness of tag organization

### 5. Flexibly Adjust Expand Depth

- Adjust based on actual usage
- Both 2-level and 3-level have advantages
- Can switch and re-expand anytime

### 6. Combine with Other Features

- Use tag color management for enhanced visual effects
- Use tag group sets to organize complex structures
- Use floating tag selector for quick insertion

---

## FAQ

### Q1: What's the difference between smart matching and rule matching?

**Smart Matching**:
- Automatic hierarchical matching
- Works with expand feature
- Only processes uncategorized tags
- No match, no add

**Rule Matching**:
- Based on keywords or regex
- Can be used independently
- Can handle any tags
- More flexible but requires manual configuration

### Q2: Why isn't my tag being automatically added?

Possible reasons:
1. Smart matching not enabled
2. Tag already in another tag group
3. No matching tag group found
4. Match mode doesn't match expand depth

Solutions:
1. Check if smart matching is enabled
2. Check if tag is already in another group
3. Confirm matching tag group exists
4. Reload plugin or restart Obsidian

### Q3: Can I use both 2-level and 3-level expand?

Not recommended. Expand depth determines tag group structure and should be consistent. If you need to switch:
1. Modify expand depth setting
2. Re-execute expansion
3. System will automatically adjust smart matching mode

### Q4: Will smart matching add tags repeatedly?

No. Smart matching only processes tags not yet added to any tag group, avoiding duplicate additions.

### Q5: How to handle tags that smart matching can't process?

Three methods:
1. Use rule matching to add custom rules
2. Manually add to appropriate tag groups
3. Create corresponding tag groups for smart matching to handle automatically

---

## Technical Details

### Tag Processing Logic

```typescript
// Pseudocode example
for (const tag of allTags) {
    // 1. Check if already in any tag group
    if (isTagInAnyGroup(tag)) {
        continue; // Skip categorized tags
    }
    
    // 2. Try smart matching
    if (smartMatchEnabled) {
        const matchedGroup = smartMatch(tag, matchMode);
        if (matchedGroup) {
            addToGroup(tag, matchedGroup);
            continue; // Successfully matched, skip rule matching
        }
    }
    
    // 3. Try rule matching
    for (const rule of rules) {
        if (matchRule(tag, rule)) {
            addToGroup(tag, rule.targetGroup);
            break; // Match successful, stop trying other rules
        }
    }
}
```

### Auto-Marking Mechanism

```typescript
// Tag group structure
interface TagGroup {
    id: string;
    name: string;
    tags: string[];              // All tags
    autoExpandedTags: string[];  // Auto-added tags
}

// Purpose:
// 1. Distinguish between manually added and auto-added tags
// 2. Respect user's delete operations (don't re-add deleted tags)
// 3. Support intelligent management and cleanup
```

---

## Changelog

### v1.8.0
- ✨ Added smart multi-level tag matching feature
- ✨ Support for 2-level and 3-level expand depth
- ✨ Automatically sets match mode based on expand depth
- 🐛 Fixed duplicate tag addition issue
- 💄 Optimized UI layout for better compactness and aesthetics

---

## Feedback & Support

If you encounter issues or have suggestions for improvement:
- Submit an Issue on GitHub
- Discuss on Obsidian Forum
- Contact developer via email

Thank you for using Tag Group Manager!
