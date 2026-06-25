# Summary
I want you to create simple web app intregated with JamAI Base platform sdk: https://docs.jamaibase.com/developer-reference/python-sdk-documentation. This web will help teacher to check subjective test answer paper with OCR and evaluator agent. This web will let users upload Subjective paper test image, then this image will be sent to JamAI Base Action table (project id:proj_9f386b9e35a4f019119bfc11, action_table: Subjective_test_checking) and JamAI base action table final column will return a result as a JSON string, you will use that result to do statistic visualize


## Tech stack
- NextJS: Frontend
- FastAPI: Backend
- JamAI Base: AI backend

## Database

### student table
- student_id
- first_name
- last_name
- year
- age

### test_paper table
- test_id (auto increment)
- student_id
- score
- evaluattion_result
- complete (yes or no)


## Backend

### Ingestion from JamAI
- You fetch JSON result of the test checking action table and put it in the database
- Please handling unavalible data from jamAI JSON (do not have enough data to insert to database) you need to have a popup for user to input the missing data manully and then set the test_paper row status to complete

### Endpoint to request test data to visualize
- Fronted can query for multiple forms for statistically visualize

## First page 
- This page is where user submit a student's test paper 
- After user press submitted a test paper, you will respond whether this paper successfully submitted or not
- If user bulk drag and drop multiple papers, it will show list of queues, each queue contains upload status

## Second page
- This page will show table of uploaded test papers with attributes column (each page contain around 25 rows and has next page function for table)
- for each test row, if any row dont have complete data you need to have a button to let user fill the information manully

## Third page
- This page is for visualization only (please design a good visualize way for teacher to monitor and use it to improve new test)