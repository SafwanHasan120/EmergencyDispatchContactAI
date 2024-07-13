import openai
import os
import re


openai.api_key ="sk-proj-kAEZnZSJzo7bB9KH0X5ZT3BlbkFJZbJaqvgz34HAY31jq9VY"
with open('prompt.txt', 'r') as file:
    text = file.read()



def get_response(prompt):
    response = openai.Completion.create(
        engine="gpt-3.5-turbo",
        prompt=prompt,
        temperature=0.9,
        max_tokens=150
    )
    return response.choices[0].text.strip()


#prompt the ai with the text vart and get the response with already existing function
def get_vart_response():
    return get_response(text)
print(get_vart_response())


#extract info
def extract_information(response_text):
    # Define the regex pattern for each category
    patterns = {
        'Location': r'- Location: \[(.*?)\]',
        'Description / Status of Individuals': r'- Description / Status of Individuals: \[(.*?)\]',
        'Type of Service': r'- Type of Service: \[(.*?)\]',
        'Situation Details': r'- Situation Details: \[(.*?)\]'
    }

    # Initialize a dictionary to store the extracted information
    extracted_info = {}

    # Iterate over the patterns and extract information
    for key, pattern in patterns.items():
        matches = re.findall(pattern, response_text)
        # Assuming there could be multiple matches, join them or handle as needed
        extracted_info[key] = ' '.join(matches) if matches else None

    return extracted_info

extracted_info = extract_information(get_vart_response())