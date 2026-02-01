#!/bin/bash

# Comprehensive Chat API Test Suite
# Tests the RAG-powered chat API with various query types

API_URL="http://localhost:4321/api/chat"
RESULTS_FILE="test-results.md"
PASSED=0
FAILED=0

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Initialize results file
cat > "$RESULTS_FILE" << 'EOF'
# Chat API Test Results

Generated: $(date)

## Summary

EOF

test_query() {
  local query="$1"
  local category="$2"
  local expected_keywords="$3"

  echo -e "${YELLOW}Testing:${NC} $query"

  response=$(curl -s -X POST "$API_URL" \
    -H 'Content-Type: application/json' \
    -d "{\"messages\":[{\"role\":\"user\",\"content\":\"$query\"}]}" 2>&1)

  content=$(echo "$response" | jq -r '.message.content' 2>/dev/null)

  if [ -z "$content" ] || [ "$content" == "null" ]; then
    echo -e "${RED}✗ FAILED${NC} - No response received"
    echo "### ❌ FAILED: $query" >> "$RESULTS_FILE"
    echo "**Category:** $category" >> "$RESULTS_FILE"
    echo "**Expected:** $expected_keywords" >> "$RESULTS_FILE"
    echo "**Response:** No response or error" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    ((FAILED++))
    return 1
  fi

  # Check if expected keywords are in the response
  local found_keywords=0
  local total_keywords=0
  IFS=',' read -ra KEYWORDS <<< "$expected_keywords"
  for keyword in "${KEYWORDS[@]}"; do
    keyword=$(echo "$keyword" | xargs) # trim whitespace
    ((total_keywords++))
    if echo "$content" | grep -qi "$keyword"; then
      ((found_keywords++))
    fi
  done

  if [ $found_keywords -gt 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC} - Found $found_keywords/$total_keywords expected keywords"
    echo "### ✅ PASSED: $query" >> "$RESULTS_FILE"
    echo "**Category:** $category" >> "$RESULTS_FILE"
    echo "**Expected keywords found:** $found_keywords/$total_keywords" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "<details><summary>Response</summary>" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "$content" | head -c 800 >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "</details>" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC} - Expected keywords not found: $expected_keywords"
    echo "### ❌ FAILED: $query" >> "$RESULTS_FILE"
    echo "**Category:** $category" >> "$RESULTS_FILE"
    echo "**Expected:** $expected_keywords" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "<details><summary>Response</summary>" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "$content" | head -c 800 >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "</details>" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    ((FAILED++))
    return 1
  fi
}

echo "=========================================="
echo "CHAT API COMPREHENSIVE TEST SUITE"
echo "=========================================="
echo ""

# ==========================================
# PERSONAL INFO QUERIES
# ==========================================
echo "--- PERSONAL INFO ---"
test_query "Where does Jacob work?" "Personal" "Deloitte, Engineering Solutions Analyst"
test_query "What is Jacob's current job?" "Personal" "Deloitte, Engineering Solutions Analyst"
test_query "Tell me about Jacob's background" "Personal" "University of Florida, Computer Engineering"
test_query "Where did Jacob go to school?" "Personal" "University of Florida"
test_query "What degree does Jacob have?" "Personal" "Computer Engineering, Bachelor"
test_query "How can I contact Jacob?" "Personal" "email, jacobkanfer"
test_query "What is Jacob's email?" "Personal" "jacobkanfer8@gmail.com"

# ==========================================
# SKILLS QUERIES
# ==========================================
echo ""
echo "--- SKILLS ---"
test_query "What programming languages does Jacob know?" "Skills" "Python, JavaScript"
test_query "Does Jacob know Python?" "Skills" "Python"
test_query "What frameworks does Jacob use?" "Skills" "React, Vue"
test_query "Does Jacob have AWS experience?" "Skills" "AWS"
test_query "What certifications does Jacob have?" "Skills" "AWS, Cloud Practitioner"

# ==========================================
# EXPERIENCE QUERIES
# ==========================================
echo ""
echo "--- EXPERIENCE ---"
test_query "What was Jacob's internship?" "Experience" "World Wide Technology, Data Science"
test_query "Tell me about World Wide Technology" "Experience" "World Wide Technology, internship, Data Science"
test_query "What leadership roles has Jacob had?" "Experience" "Student Government, Chief of Staff"
test_query "Was Jacob in student government?" "Experience" "Student Government, Senate"
test_query "What awards has Jacob won?" "Experience" "Florida Blue Key, Stratton"
test_query "Tell me about the AHSR project" "Experience" "AHSR, robot, autonomous, hospital"

# ==========================================
# PROJECT QUERIES
# ==========================================
echo ""
echo "--- PROJECTS ---"
test_query "What projects has Jacob built?" "Projects" "BTC Explorer, Git Archiver"
test_query "Tell me about BTC Explorer" "Projects" "Bitcoin, blockchain"
test_query "How does Git Archiver work?" "Projects" "Git, archive"
test_query "What is the Differential Growth project?" "Projects" "Differential Growth, algorithm"
test_query "Tell me about Jacob's open source work" "Projects" "GitHub, open source"

# ==========================================
# BLOG QUERIES
# ==========================================
echo ""
echo "--- BLOG ---"
test_query "Has Jacob written any blog posts?" "Blog" "blog, WebLLM, RAG"
test_query "How did Jacob build the AI assistant for his portfolio?" "Blog" "WebLLM, embeddings, RAG"
test_query "What is Claude Code?" "Blog" "Claude Code, AI"

# ==========================================
# EDGE CASE QUERIES
# ==========================================
echo ""
echo "--- EDGE CASES ---"
test_query "Who is Jacob?" "Edge Case" "Jacob Kanfer, Deloitte"
test_query "What can you tell me about Jacob Kanfer?" "Edge Case" "Jacob, Deloitte"
test_query "Is Jacob available for hire?" "Edge Case" "contact, email"
test_query "What technologies does Jacob specialize in?" "Edge Case" "AI, Python"

# ==========================================
# SUMMARY
# ==========================================
echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"
TOTAL=$((PASSED + FAILED))
PERCENTAGE=$((PASSED * 100 / TOTAL))
echo "Total: $TOTAL"
echo "Pass Rate: $PERCENTAGE%"

# Update results file with summary
sed -i '' "s/## Summary/## Summary\n\n- **Passed:** $PASSED\n- **Failed:** $FAILED\n- **Total:** $TOTAL\n- **Pass Rate:** $PERCENTAGE%\n\n---/" "$RESULTS_FILE"

# Add timestamp
sed -i '' "s/Generated: \$(date)/Generated: $(date)/" "$RESULTS_FILE"

echo ""
echo "Results written to: $RESULTS_FILE"
