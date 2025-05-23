-- keywords.lua

local function play()
  print("Hey there! What's your name? ")
  local player_name = io.read("*l")

  if player_name == "" then
    player_name = "Friend"
  end

  local reversed_chars = {}
  for pos = #player_name, 1, -1 do
    reversed_chars[#reversed_chars + 1] = player_name:sub(pos, pos)
  end

  local reversed_name = table.concat(reversed_chars)
  print("\nTa‑da! Your name backwards is: " .. reversed_name .. "\n")

  local countdown = 3
  repeat
    print(countdown .. "…")
    countdown = countdown - 1
  until countdown == 0
  print("Go! 🚀\n")

  local secret_letter = reversed_name:sub(1, 1) or "A" 
  local attempts_remaining = 3
  while attempts_remaining > 0 do
    print("Guess the FIRST letter of your backwards name (" .. attempts_remaining .. " tries left): ")
    local guess = io.read("*l") or ""

    if guess == secret_letter then
      print("Correct! You rock! 🎉\n")
      break
    elseif guess == "" then
      print("You pressed Enter—give me a letter!\n")
    else
      print("Nope, try again!\n")
    end

    attempts_remaining = attempts_remaining - 1
  end

  if attempts_remaining == 0 then
    print("The letter was '" .. secret_letter .. "'. Better luck next time!\n")
  end

  for index, letter in ipairs(reversed_chars) do
    do
      local is_vowel = letter:match("[AEIOUaeiou]") and true or false 
      local decoration = is_vowel and "*" or "#"
      print(decoration .. letter .. decoration)
    end
  end

  local treasure_found = false

  print("\nType 'secret' to unlock a hidden treasure (or press Enter to skip): ")
  local response = io.read("*l") or ""

  if response == "secret" then
    goto treasure
  else
    print("No treasure this time—maybe next round!\n")
  end

  ::treasure::
  if not treasure_found then
    print("✨ You discovered the hidden Lua keyword treasure! ✨\n")
    treasure_found = true
  end

  local mysterious_nothing = nil 

  return reversed_name
end

play()
