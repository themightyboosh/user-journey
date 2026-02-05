// Test suite for prompt generation logic
import { buildSystemInstruction, BASE_SYSTEM_INSTRUCTION } from '../config/prompts.js';

// Since we can't use Jest directly in this environment easily without setup, 
// I will create a standalone runner to verify the logic.

function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ FAIL: ${message}`);
    }
    console.log(`✅ PASS: ${message}`);
}

function assertContains(text, substring, message) {
    if (!text.includes(substring)) {
        throw new Error(`❌ FAIL: ${message}\nExpected to find: "${substring}"\nIn text: ${text.substring(0, 100)}...`);
    }
    console.log(`✅ PASS: ${message}`);
}

function runTests() {
    console.log("🚀 Running Prompt Logic Tests...\n");

    // Test 1: Default Behavior
    // Should use the default "Welcome the user by name..." instruction
    const defaultOutput = buildSystemInstruction({});
    assertContains(
        defaultOutput, 
        "Welcome the user by name if known, thank them for their time and helping Goods & Services make great software.", 
        "Default prompt should contain standard welcome instruction"
    );
    assertContains(
        defaultOutput,
        "**Welcome & Identity Check**",
        "Default prompt should keep original Step 1 title"
    );

    // Test 2: Custom Message Override (Direct String)
    // Should replace Step 1 with "Welcome Override" and inject the custom message
    const customMessage = "SYSTEM_ALERT: Unauthorized Access.";
    const overrideOutput = buildSystemInstruction({ welcomePrompt: customMessage });
    
    assertContains(
        overrideOutput,
        "**Welcome Override**",
        "Override should replace Step 1 with 'Welcome Override'"
    );
    assertContains(
        overrideOutput,
        customMessage,
        "Override should contain the custom message inside the instruction"
    );
    assertContains(
        overrideOutput,
        "The user has provided a custom welcome message or instruction",
        "Override should include the logic explaining how to handle the input"
    );

    // Test 3: Custom Instruction Override (Persona)
    const customInstruction = "Act like a grumpy wizard.";
    const instructionOutput = buildSystemInstruction({ welcomePrompt: customInstruction });
    
    assertContains(
        instructionOutput,
        customInstruction,
        "Override should contain the custom instruction"
    );

    console.log("\n🎉 All tests passed!");
}

try {
    runTests();
} catch (e) {
    console.error(e.message);
    process.exit(1);
}
