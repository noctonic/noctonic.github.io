local P = require("pattern")
P.ALIAS()

print("Guess the secret words! You can type multiple words separated by spaces.")
local win = false
while not win do
    print("Your guess: ")
    local input = io.read()
    if is_match(input, "quit") then
        print("Goodbye!")
        break
    end
    local guessedWords = {}
    for word in input:gmatch("%S+") do
        table.insert(guessedWords, word)
    end

    local matched = false
    local confusingPattern = TUPLE(
        AND(NOT("grapes"),"apple",NOT("grapes")),
        AND(NOT(OR("orange",NOT("grapes"))),NOT("apple")))
    win = is_match(guessedWords,confusingPattern)
    
    if not win then
        print("Nope, try again.")
    end
end
