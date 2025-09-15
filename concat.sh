#!/bin/bash

# The name of the final output file
OUTPUT_FILE="project_review.txt"

# A list of file extensions to include
EXTENSIONS=(-name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.html")

# Clear the output file to start fresh
> "$OUTPUT_FILE"

echo "🚀 Starting to bundle project files for review..."

# Find all files with the specified extensions, excluding the node_modules directory
# and the package-lock.json file. Then, loop through each found file.
find . -path ./node_modules -prune -o -type f \( "${EXTENSIONS[@]}" \) \
| grep -v "package-lock.json" \
| while IFS= read -r file; do
    echo "Adding: $file"
    
    # Append a clear header for each file to the output
    echo "--- START OF FILE: $file ---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE" # Add a blank line for readability
    
    # Append the content of the current file
    cat "$file" >> "$OUTPUT_FILE"
    
    # Append a footer and some newlines to separate the files
    echo "" >> "$OUTPUT_FILE"
    echo "--- END OF FILE: $file ---" >> "$OUTPUT_FILE"
    echo -e "\n\n" >> "$OUTPUT_FILE"
done

echo "✅ Success! All files have been concatenated into $OUTPUT_FILE."
